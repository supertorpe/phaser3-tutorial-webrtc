import { Mesh, PeerRecord } from 'mplaynet';

import { MultiplayerScene, GameState } from "./multiplayer-scene";
import VirtualJoystick from 'phaser3-rex-plugins/plugins/virtualjoystick.js';


export class MainScene extends MultiplayerScene {

    private waitingText!: Phaser.GameObjects.Text;
    private scoreTexts!: Phaser.GameObjects.Text[];

    private platforms!: Phaser.Physics.Arcade.StaticGroup;
    private players!: Phaser.Physics.Arcade.Group;
    private stars!: Phaser.Physics.Arcade.Group;
    private bombs!: Phaser.Physics.Arcade.Group;
    private arrow!: Phaser.Types.Input.Keyboard.CursorKeys;
    private joyStick!: VirtualJoystick;
    private joystickKeys!: {
        up: Phaser.Input.Keyboard.Key,
        down: Phaser.Input.Keyboard.Key,
        left: Phaser.Input.Keyboard.Key,
        right: Phaser.Input.Keyboard.Key,
    };

    constructor(myUUID: string, peers: PeerRecord[], mesh: Mesh, timeToStart: number) {
        super("mainScene", myUUID, peers, mesh, timeToStart);
    }

    preload() {
        this.load.image("sky", "assets/sky.png");
        this.load.image("ground", "assets/platform.png");
        this.load.image("star", "assets/star.png");
        this.load.image("bomb", "assets/bomb.png");
        this.load.spritesheet("dude", "assets/dude.png", {
            frameWidth: 32,
            frameHeight: 42
        });
        this.load.spritesheet("dude2", "assets/dude2.png", {
            frameWidth: 32,
            frameHeight: 42
        });
    }

    sceneCreate(): GameState {
        /////////////////// BACKGROUND ///////////////////
        this.add.image(0, 0, "sky").setOrigin(0, 0);

        /////////////////// SCOREBOARD ///////////////////
        this.scoreTexts = [];
        const style = { font: "20px Arial", fill: "#fff" };
        for (let [index, peer] of this.peers.entries()) {
            this.scoreTexts[index] = this.add.text(
                20,
                20 + index * 30,
                `${peer.username}: 0`,
                style
            );
        }

        /////////////////// SYNC MSG ///////////////////
        this.waitingText = this.add.text(300, 300, "waiting for sync ...", style);

        /////////////////// PLATFORMS ///////////////////
        this.platforms = this.physics.add.staticGroup();
        this.platforms.create(400, 568, 'ground').setScale(2).refreshBody();
        this.platforms.create(600, 400, 'ground');
        this.platforms.create(50, 250, 'ground');
        this.platforms.create(750, 220, 'ground');

        /////////////////// ANIMATIONS ///////////////////
        //  Player animations, turning, walking left and walking right.
        this.anims.create({
            key: "left",
            frames: this.anims.generateFrameNumbers("dude", { start: 0, end: 3 }),
            frameRate: 10,
            repeat: -1
        });
        this.anims.create({
            key: "turn",
            frames: [{ key: "dude", frame: 4 }],
            frameRate: 20
        });
        this.anims.create({
            key: "right",
            frames: this.anims.generateFrameNumbers("dude", { start: 5, end: 8 }),
            frameRate: 10,
            repeat: -1
        });
        //  Opponents animations, turning, walking left and walking right.
        this.anims.create({
            key: "left2",
            frames: this.anims.generateFrameNumbers("dude2", { start: 0, end: 3 }),
            frameRate: 10,
            repeat: -1
        });
        this.anims.create({
            key: "turn2",
            frames: [{ key: "dude2", frame: 4 }],
            frameRate: 20
        });
        this.anims.create({
            key: "right2",
            frames: this.anims.generateFrameNumbers("dude2", { start: 5, end: 8 }),
            frameRate: 10,
            repeat: -1
        });

        /////////////////// CREATE PLAYERS AND SCORES ///////////////////
        this.players = this.physics.add.group({
            collideWorldBounds: true,
            bounceX: 0.2, bounceY: 0.2,
            frictionX: 0, frictionY: 0,
            maxVelocityX: 200, maxVelocityY: 200,
            mass: 0.5
        });

        const scores: number[] = [];
        for (let [index, peer] of this.peers.entries()) {
            scores[index] = 0;
            let plyr = this.players.create(100 + index * 40, 450, peer.uuid === this.myUUID ? 'dude' : 'dude2');
            plyr.setName(peer.uuid);
            plyr.setData('uuid', peer.uuid);
            plyr.setData('interpolate', true);
            plyr.setData('peerIndex', index);
            plyr.setBounce(0.2,0.2);
            plyr.anims.play(peer.uuid === this.myUUID ? 'turn' : 'turn2');
        }

        /////////////////// GAME STATE ///////////////////
        const gameState = new GameState(this.physics.world, { scores: scores, bombCount: 0 });

        /////////////////// STARS ///////////////////
        this.stars = this.physics.add.group({
            collideWorldBounds: true,
            bounceX: 0.2, bounceY: 0.2,
            frictionX: 0, frictionY: 0,
            maxVelocityX: 200, maxVelocityY: 200,
            mass: 0.5
        });
        for (let i = 0; i < 12; i++) {
            const star = this.stars.create(12 + 70*i, 0, 'star') as Phaser.Physics.Arcade.Sprite;
            star.setName(`star${i+1}`);
            star.setMaxVelocity(0, 200); // limit vert velocity to avoid tunneling through platforms
            star.setData('interpolate', true);
        }
        this.stars.children.iterate((gameObject, index) => {
            //  Give each star a slightly different bounce and set its index
            const star = gameObject as Phaser.Physics.Arcade.Sprite;
            star.setBounceY(this.nextRandom(gameState.randomPointer++,4, 8) / 10);
            star.setData('index', index);
        });

        /////////////////// BOMBS ///////////////////
        this.bombs = this.physics.add.group({
            collideWorldBounds: true,
            allowGravity: false,
            bounceX: 1, bounceY: 1
        });

        /////////////////// KEYBOARD ///////////////////
        this.arrow = this.input.keyboard.createCursorKeys();

        /////////////////// JOYSTICK ///////////////////
        this.joyStick = new VirtualJoystick(this, {
            x: 700,
            y: 500,
            radius: 50,
            base: this.add.circle(0, 0, 100, 0x888888, 0.5),
            thumb: this.add.circle(0, 0, 50, 0xcccccc, 0.5)
            // dir: '8dir',   // 'up&down'|0|'left&right'|1|'4dir'|2|'8dir'|3
            // forceMin: 16,
            // enable: true
        });
        this.joystickKeys = this.joyStick.createCursorKeys();

        /////////////////// RETURN INITIAL GAME STATE ///////////////////
        return gameState;
    }

    readyToStart(): void {
        this.waitingText.visible = false;
    }

    newGameState(_prevState: GameState, newState: GameState, _rewritingHistory: boolean): void {
        this.physics.add.collider(this.players,this.players);
        this.physics.add.collider(this.players, this.platforms);
        this.physics.add.collider(this.stars, this.platforms);
        this.physics.add.collider(this.bombs, this.platforms);

        this.physics.add.overlap(this.players, this.stars, (player, star) => {
            if (!player.getData('playerCollectingStar')) {
                player.setData('playerCollectingStar', star);
                this.collectStar(newState, player, star);
            }
        });
        this.physics.add.overlap(this.players, this.bombs, (player, bomb) => {
            if (!player.getData('playerBeingHit')) {
                player.setData('playerBeingHit', bomb);
                this.hitBomb(newState, player);
            }
        });
        this.players.children.entries.forEach((player) => {
            if (player.getData('playerBeingHit') && !this.physics.overlap(player, player.getData('playerBeingHit'))) {
                player.setData('playerBeingHit',false);
                (player as Phaser.Physics.Arcade.Sprite).clearTint();
            }
            if (player.getData('playerCollectingStar') && !this.physics.overlap(player, player.getData('playerCollectingStar'))) {
                player.setData('playerCollectingStar',false);
            }
        });
    }

    private STRENGTH_X = 100;
    private STRENGTH_Y = 500;
    applyCommandToBody(body: Phaser.Physics.Arcade.Body, command: number, _info: any): void {
        // physics
       body.setAcceleration(
            command == 10 || command == 12
                ? this.STRENGTH_X
                : command == 20 || command == 22
                    ? -this.STRENGTH_X
                    : 0,
            body.touching.down && (command == 2 || command == 12 || command == 22)
                ? -this.STRENGTH_Y
                : 0
        );
        // animations
        const sprite = body.gameObject as Phaser.Physics.Arcade.Sprite;
        const isMySprite = sprite.getData('peerIndex') === this.myIndex;
        if (command == 20 || command == 22) {
            sprite.anims.play(isMySprite ? "left" : "left2", true);
          } else if (command == 10 || command == 12) {
            sprite.anims.play(isMySprite ? "right" : "right2", true);
          } else {
              sprite.anims.play(isMySprite ? "turn" : "turn2");
          }
    }

    readCommand(): number {
        let right =
            this.arrow.right.isDown ||
            (this.joystickKeys["right"] && this.joystickKeys["right"].isDown);
        let left =
            this.arrow.left.isDown ||
            (this.joystickKeys["left"] && this.joystickKeys["left"].isDown);
        let up =
            this.arrow.up.isDown ||
            (this.joystickKeys["up"] && this.joystickKeys["up"].isDown);

        return (right ? 10 : left ? 20 : 0) + (up ? 2 : 0);
    }

    render(gameState: GameState): void {
        for (let [index, peer] of this.peers.entries()) {
            this.scoreTexts[index].setText(
                `${peer.username}: ${gameState.info.scores[index]} ${this.isDisconnected(peer.uuid) ? " (disconnected)" : ""
                }`
            );
        }
    }

    cloneGameStateInfo(info: any): any {
        return {
            scores: [...info.scores],
            bombCount: info.bombCount
        }
    }

    collectStar(gameState: GameState, player: Phaser.Types.Physics.Arcade.GameObjectWithBody, star: Phaser.Types.Physics.Arcade.GameObjectWithBody) {
        const playerIndex = player.getData('peerIndex');
        // update score
        gameState.info.scores[playerIndex] += 10;
        // disable star
        (star as Phaser.Physics.Arcade.Sprite).disableBody(true, true);
        // all stars collected?
        if (this.stars.countActive(true) === 0) {
            // reset all stars position
            this.stars.children.iterate((gameObject) => {
                const child = gameObject as Phaser.Physics.Arcade.Sprite;
                child.enableBody(true, child.x, 0, true, true);
            });
            // create or reuse a bomb
            gameState.info.bombCount++;
            const bombName = `bomb${gameState.info.bombCount}`;
            let bomb = this.bombs.children.getArray().find((go) => {go.name == bombName}) as Phaser.Physics.Arcade.Sprite;
            if (!bomb) {
                bomb = this.bombs.create(400, 16, "bomb");
                bomb.setName(bombName);
                bomb.setData('interpolate', true);
            } else {
                bomb.x = 400;
                bomb.y = 16;
            }
            bomb.setVelocity(this.nextRandom(gameState.randomPointer++,50, 100), 100);
        }
    }

    hitBomb(gameState: GameState, player: Phaser.Types.Physics.Arcade.GameObjectWithBody) {
        const playerIndex = player.getData('peerIndex');
        // update score
        gameState.info.scores[playerIndex] -= 10;
        //if (gameState.info.scores[playerIndex] < 0)
        //    gameState.info.scores[playerIndex] = 0;
        // tint player
        const sprite = gameState.world.bodies.getArray().find((body) => playerIndex == body.gameObject.getData('peerIndex'))?.gameObject as Phaser.Physics.Arcade.Sprite;
        sprite.setTint(0xff0000);
    }

}