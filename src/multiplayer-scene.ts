import Phaser from 'phaser';
import { Mesh, PeerRecord, getLocalTimestamp, Message } from 'mplaynet';
import { WorldCloner } from './world-cloner';

const DEBUG = {
    GAMESTATE: false,
    SEND: false,
    RECEIVE: false,
    INFO: false,
    WARN: true
};

const LAG_SIMULATION = 0;
const MAKE_INTERPOLATION = true;
const TIMESLICE = 100;
const RENDER_DELAY = 2;

export class GameState {

    private _slice!: number;
    private _time!: number;
    private _world!: Phaser.Physics.Arcade.World;
    private _commands!: Uint16Array[];
    private _randomPointer!: number;
    private _info!: any;

    get slice(): number { return this._slice; }
    set slice(value: number) { this._slice = value; }
    get time(): number { return this._time; }
    set time(value: number) { this._time = value; }
    get world(): Phaser.Physics.Arcade.World { return this._world; }
    set world(value: Phaser.Physics.Arcade.World) { this._world = value; }
    get commands(): Uint16Array[] { return this._commands; }
    set commands(value: Uint16Array[]) { this._commands = value; }
    get randomPointer(): number { return this._randomPointer; }
    set randomPointer(value: number) { this._randomPointer = value; }
    get info(): any { return this._info; }
    set info(value: any) { this._info = value; }

    constructor(
        slice: number,
        time: number,
        world: Phaser.Physics.Arcade.World,
        commands: Uint16Array[],
        randomPointer: number,
        info: any
    );

    constructor(
        world: Phaser.Physics.Arcade.World, info: any
    );

    constructor(...args: any[]) {
        if (args.length == 2) {
            this._world = args[0];
            this._info = args[1];
        } else if (args.length == 6) {
            this._slice = args[0];
            this._time = args[1];
            this._world = args[2];
            this._commands = args[3];
            this._randomPointer = args[4];
            this._info = args[5];
        }
    }
}

class CommandBufferItem {
    constructor(
        public slice: number, public command: Uint16Array
    ) { }
}

export abstract class MultiplayerScene extends Phaser.Scene {

    private randomGenerator: Phaser.Math.RandomDataGenerator;
    private worldCloner = new WorldCloner();
    protected peers: PeerRecord[];
    private mesh: Mesh;
    private _uuid: string;
    private _myIndex: number;
    private peersDisconnected: string[] = [];
    private gameHistory: GameState[];
    private latestGameState!: GameState;
    private renderGameStateIdx!: number;
    private commandBuffer: CommandBufferItem[];
    private userCommand!: Uint16Array;
    private randomValues: number[];
    private running = false;
    private timeToStart: number;
    private messagesReceived: number;
    private messagesSent: number;

    get myUUID(): string { return this._uuid; }
    get myIndex(): number { return this._myIndex; }

    constructor(sceneName: string, myUUID: string, peers: PeerRecord[], mesh: Mesh, timeToStart: number) {
        super(sceneName);
        if (DEBUG.INFO) console.log(`getLocalTimestamp=${getLocalTimestamp()}`);
        this.randomGenerator = new Phaser.Math.RandomDataGenerator(['1234567890']);
        this._uuid = myUUID;
        this._myIndex = peers.findIndex((peer) => peer.uuid == myUUID);
        this.peers = peers;
        this.mesh = mesh;
        mesh.messageEmitter.addEventListener((uuid, message) => {
            this.messageReceived(uuid, message);
        });
        mesh.connectionReadyEmitter.addEventListener((uuid, ready) => {
            if (!ready) {
                // player disconnected
                const peer = peers.find((peer) => peer.uuid === uuid);
                if (peer) this.peersDisconnected.push(peer.uuid);
            }
        });
        this.gameHistory = [];
        this.commandBuffer = [];
        this.randomValues = [];
        this.running = false;
        this.timeToStart = timeToStart;
        this.messagesReceived = 0;
        this.messagesSent = 0;
    }

    create() {
        this.physics.world.pause();
        const initialGameState = this.sceneCreate();
        initialGameState.slice = 0;
        initialGameState.time = this.timeToStart;
        initialGameState.randomPointer = -1;
        initialGameState.commands = new Array(this.peers.length);
        this.gameHistory.push(initialGameState);
        this.latestGameState = initialGameState;
        this.renderGameStateIdx = 0;
    }

    doStep(timestamp: number) {
        // check if a new gamestate needs to be created
        const latestTimestamp =
            this.timeToStart + (1 + this.latestGameState.slice) * TIMESLICE;
        if (timestamp >= latestTimestamp) {
            // if there are gaps in history, fill it with fake gamestates
            const gapsInHistory = timestamp >= latestTimestamp + TIMESLICE;
            if (gapsInHistory) {
                const gamestatesToBuild = Math.ceil(
                    (timestamp - latestTimestamp) / TIMESLICE
                );
                if (DEBUG.WARN)
                    console.log(
                        `There are ${gamestatesToBuild} gaps in game history. Latest known gamestate: ${this.latestGameState.slice}`
                    );
                for (let i = 1; i < gamestatesToBuild; i++) {
                    this.gameHistory.push(new GameState(
                        this.latestGameState.slice + i,
                        this.latestGameState.time + i * TIMESLICE,
                        new Phaser.Physics.Arcade.World(this, {}),
                        new Array(this.peers.length),
                        this.latestGameState.randomPointer,
                        this.cloneGameStateInfo(this.latestGameState.info)
                    ));
                }
            }
            // load commands into gameStates and check if history needs to be rewritten
            let rewriteHistoryFrom = this.loadCommandsIntoGameStates();
            if (
                gapsInHistory &&
                (rewriteHistoryFrom == null ||
                    this.latestGameState.slice < rewriteHistoryFrom.slice)
            ) {
                rewriteHistoryFrom = this.latestGameState;
            }
            if (rewriteHistoryFrom) {
                this.rewriteHistory(rewriteHistoryFrom);
            }
            if (DEBUG.GAMESTATE) this.debugGameState(this.latestGameState);
            this.latestGameState = this.nextGameState(true,
                this.gameHistory[this.gameHistory.length - 1]
            );
            this.gameHistory.push(this.latestGameState);
            // clean old gameHistory
            while (this.gameHistory.length > 1000) {
                this.gameHistory.shift();
            }
            if (this.gameHistory.length > RENDER_DELAY + 1) {
                this.renderGameStateIdx = this.gameHistory.length - (RENDER_DELAY + 1);
            }
        }
    }

    update() {
        const timestamp = getLocalTimestamp();
        // wait to timeToStart
        if (!this.running && timestamp >= this.timeToStart) {
            this.running = true;
            if (DEBUG.INFO) console.log("running!!!");
            this.readyToStart();
        }
        if (!this.running) {
            return;
        }
        
        // Read user command
        let commandValue = this.readCommand();
        if (!this.userCommand) this.userCommand = new Uint16Array(4);
        if (!this.userCommand[2] || this.userCommand[2] !== commandValue) {
            this.userCommand[0] = 0;
            this.userCommand[1] = this.myIndex;
            this.userCommand[2] = commandValue;
            this.userCommand[3] = this.latestGameState.slice;
            if (DEBUG.SEND)
                console.log(
                    `send command: ${this.userCommand[2]}, slice=${this.userCommand[3]}. total=${++this
                        .messagesSent}`
                );
            if (LAG_SIMULATION) {
                setTimeout(() => {
                    this.mesh.broadcast(this.userCommand.buffer);
                }, LAG_SIMULATION);
            } else {
                this.mesh.broadcast(this.userCommand.buffer);
            }
        }
        // do step
        this.doStep(timestamp);
        // render game objects
        this.renderObjects(this.renderGameStateIdx);
    }

    renderObjects(gameStateIdx: number) {
        const now = getLocalTimestamp() - TIMESLICE * RENDER_DELAY;
        const gameState = this.gameHistory[gameStateIdx];
        // make interpolation ?
        const makeInterpolation = (MAKE_INTERPOLATION && this.gameHistory.length > gameStateIdx + 1);

        let nextStateBodies: Phaser.Physics.Arcade.Body[] | undefined;
        let bodies = gameState.world.bodies.getArray();

        for (let [index, body] of bodies.entries()) {
            if (!body.enable)
                continue;
            const phaserObject = body.gameObject;
            if (phaserObject) {
                const sprite = phaserObject as Phaser.Physics.Arcade.Sprite;
                if (makeInterpolation && phaserObject.getData('interpolate')) {
                    let gameStateNext = this.gameHistory[gameStateIdx + 1];
                    if (!nextStateBodies) nextStateBodies = gameStateNext.world.bodies.getArray();
                    let bodyNext = nextStateBodies[index];
                    this.interpolate(
                        sprite,
                        now,
                        gameState.time,
                        body.position,
                        body.velocity,
                        gameStateNext.time,
                        bodyNext.position,
                        bodyNext.velocity
                    );
                } else {
                    let bodyPosition = body.position;
                    sprite.x = bodyPosition.x + sprite.displayOriginX;
                    sprite.y = bodyPosition.y + sprite.displayOriginY;
                }
            }
        };
        this.render(gameState);
    }

    nextGameState(dumpUserCommand: boolean, gameState: GameState, newGameState?: GameState): GameState {
        let result: GameState;
        if (newGameState) {
            result = newGameState;
            result.world = this.cloneWorld(gameState.world);
            result.randomPointer = gameState.randomPointer;
            result.info = this.cloneGameStateInfo(gameState.info);
            // preserve previous commands
        } else {
            //this.debugGameState(gameState);
            result = new GameState(
                gameState.slice + 1,
                gameState.time + TIMESLICE,
                this.cloneWorld(gameState.world),
                new Array(this.peers.length),
                gameState.randomPointer,
                this.cloneGameStateInfo(gameState.info),
            );
        }
        if (dumpUserCommand) result.commands[this.myIndex] = this.userCommand;
        // reasign the world
        this.physics.world = result.world;
        this.physics.add.world = result.world;
        this.sys.updateList.getActive().forEach((obj) => {
            if (obj instanceof Phaser.Physics.Arcade.Group) {
                (obj as Phaser.Physics.Arcade.Group).world = result.world;
            } else if (obj instanceof Phaser.GameObjects.GameObject) {
                ((obj as Phaser.GameObjects.GameObject).body as Phaser.Physics.Arcade.Body).world = result.world;
            }
        });
        const bodies = result.world.bodies.getArray();
        bodies.forEach((body) => { body.gameObject.body = body; });

        this.newGameState(gameState, result, newGameState != null);

        for (let command of gameState.commands) {
            if (command === undefined) continue;
            const body = bodies.find(body => body.gameObject.getData('peerIndex') == command[1]);
            if (body) this.applyCommandToBody(body, command[2], gameState.info);
        }

        result.world.step(TIMESLICE / 1000);

        return result;
    }

    isDisconnected(uuid: string): boolean {
        return this.peersDisconnected.find(_uuid => _uuid === uuid) !== undefined;
    }

    rewriteHistory(gameState: GameState) {
        if (DEBUG.WARN)
            console.group(`rewriteHistory from gameState ${gameState.slice}`);
        if (DEBUG.GAMESTATE) this.debugGameState(gameState);
        let index = this.gameHistory.findIndex(
            (gs) => gs.slice === gameState.slice
        );
        let slice = gameState.slice;
        while (index >= 0 && index < this.gameHistory.length - 1) {
            if (DEBUG.WARN) console.log(`rewriting gameState ${++slice}`);
            const gameStateNext = this.nextGameState(false,
                this.gameHistory[index],
                this.gameHistory[index + 1]
            );
            if (DEBUG.GAMESTATE) this.debugGameState(gameStateNext);
            index++;
        }
        if (DEBUG.WARN) console.groupEnd();
    }

    messageReceived(uuid: string, message: Message) {
        const netcommand = new Uint16Array(message.body);
        switch (netcommand[0]) {
            case 0: // player keystroke
                if (DEBUG.RECEIVE)
                    console.log(
                        `message from ${uuid}: command: ${netcommand[2]}, slice=${netcommand[3]
                        }. total=${++this.messagesReceived}`
                    );
                this.commandBuffer.push({
                    slice: netcommand[3],
                    command: netcommand
                });
                //this.doStep();
                break;
        }
    }

    loadCommandsIntoGameStates() {
        let rewriteHistoryFromSlice;
        const historyLength = this.gameHistory.length;
        const firstSlice = this.gameHistory[0].slice;
        const commandBufferSize = this.commandBuffer.length;
        let removed = 0;
        for (let index = 0; index < commandBufferSize; index++) {
            let item = this.commandBuffer[index - removed];
            if (item.slice >= firstSlice && item.slice < firstSlice + historyLength) {
                const gameState = this.gameHistory[item.slice - firstSlice];
                // if the command is different from the stored one
                if (!gameState.commands[item.command[1]] || gameState.commands[item.command[1]][2] != item.command[2]) {
                    // rewind rewriteHistoryFromSlice?
                    if (
                        item.slice < firstSlice + historyLength - 1 &&
                        (!rewriteHistoryFromSlice || rewriteHistoryFromSlice > item.slice)
                    ) {
                        rewriteHistoryFromSlice = item.slice;
                    }
                    // store command
                    gameState.commands[item.command[1]] =
                        item.command;
                }
                this.commandBuffer.splice(index - removed++, 1);
            }
        }
        return rewriteHistoryFromSlice
            ? this.gameHistory[rewriteHistoryFromSlice - firstSlice]
            : null;
    }

    findBodyByPhaserName(gameState: GameState, name: string) {
        return gameState.world?.bodies.getArray().find(body => body.gameObject && body.gameObject.name === name);
    }

    // abstract methods
    abstract sceneCreate(): GameState;
    abstract readyToStart(): void;
    abstract newGameState(prevState: GameState, newState: GameState, rewritingHistory: boolean): void;
    abstract applyCommandToBody(body: Phaser.Physics.Arcade.Body, command: number, info: any): void;
    abstract readCommand(): number;
    abstract render(gameState: GameState): void;
    abstract cloneGameStateInfo(info: any): any;

    // utility methods

    interpolate(phaserObject: Phaser.Physics.Arcade.Sprite, time: number,
        time0: number, pos0: Phaser.Math.Vector2, vel0: Phaser.Math.Vector2,
        time1: number, pos1: Phaser.Math.Vector2, vel1: Phaser.Math.Vector2) {
        /*
        const timeDiff = time - time0;
        phaserObject.x =
            (pos0.x + (timeDiff * (pos1.x - pos0.x)) / TIMESLICE) *
            WORLD_SCALE;
        phaserObject.y =
            (pos0.y + (timeDiff * (pos1.y - pos0.y)) / TIMESLICE) *
            WORLD_SCALE;
        //*/
        //*
        const timeDiff1 = time - time0;
        const timeDiff2 = time - time1;
        if (Math.sign(vel0.x) === Math.sign(vel1.x)) {
            // if velocity has the same sign, use position-based interpolation
            phaserObject.x = phaserObject.displayOriginX +
                (pos0.x + (timeDiff1 * (pos1.x - pos0.x)) / TIMESLICE);
        } else {
            // if the velocity is opposite, calc new position based on previous position and velocity
            if (timeDiff1 < -timeDiff2) {
                phaserObject.x = phaserObject.displayOriginX + (pos0.x + vel0.x * timeDiff1 / 1000);
            } else {
                phaserObject.x = phaserObject.displayOriginX + (pos1.x + vel1.x * timeDiff2 / 1000);
            }
        }
        if (Math.sign(vel0.y) === Math.sign(vel1.y)) {
            // if velocity has the same sign, use position-based interpolation
            phaserObject.y = phaserObject.displayOriginY +
                (pos0.y + (timeDiff1 * (pos1.y - pos0.y)) / TIMESLICE);
        } else {
            // if the velocity is opposite, calc new position based on previous position and velocity
            if (timeDiff1 < -timeDiff2) {
                phaserObject.y = phaserObject.displayOriginY + (pos0.y + vel0.y * timeDiff1 / 1000);
            } else {
                phaserObject.y = phaserObject.displayOriginY + (pos1.y + vel1.y * timeDiff2 / 1000);
            }
        }
        //*/
        // calc acceleration
        /*
                const timeDiff = (time - time0) / 1000;
                const velx = vel0.x + (timeDiff * (vel1.x - vel0.x)) / (TIMESLICE / 1000) ;
                const vely = vel0.y + (timeDiff * (vel1.y - vel0.y)) / (TIMESLICE / 1000) ;
                const ax = (velx - vel0.x) / timeDiff;
                const ay = (vely - vel0.y) / timeDiff;
                const posx = pos0.x + vel0.x * timeDiff + ax * timeDiff * timeDiff / 2;
                const posy = pos0.y + vel0.y * timeDiff + ay * timeDiff * timeDiff / 2;
                phaserObject.x = posx * WORLD_SCALE;
                phaserObject.y = posy * WORLD_SCALE;
        //*/
    }

    nextRandom(randomPointer: number, min: number, max: number) {
        randomPointer++;
        for (let i = this.randomValues.length; i <= randomPointer; i++) {
            let rnd = min + (this.randomGenerator.between(min, max));
            this.randomValues.push(rnd);
        }
        return this.randomValues[randomPointer];
    }

    cloneWorld(world: Phaser.Physics.Arcade.World): Phaser.Physics.Arcade.World {
        return this.worldCloner.clone(world);
    }

    debugGameState(gameState: GameState) {
        let log = `gameState ${gameState.slice}\n  bodies\n`;
        if (gameState.world) {
            gameState.world.bodies.iterate((body) => {
                if (body.gameObject)
                    log += `    ${body.gameObject.name} x=${body.x},y=${body.y}\n`;
            });
        }
        log += "  commands:";
        gameState.commands.forEach((command) => {
            if (command) log += `${command[1]}:${command[2]} `;
        });
        log += `\n  randomPointer: ${gameState.randomPointer}\n`;
        log += `  info: ${JSON.stringify(gameState.info)}\n`;
        console.log(log);
    }

}