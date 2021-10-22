import { MeshConfig, Mesh, PeerRecord, setDebug } from 'mplaynet';
import { MainScene } from './main-scene';

///// SIGNALIGN MECHANISM /////
// Local: for development
import { LocalSignaling } from 'mplaynet';
// Deepstream
//import { DeepstreamSignaling } from 'mplaynet/src/mplaynet-deepstream';
// Firebase
//import { FirebaseSignaling } from 'mplaynet/src/firebase-signaling';

const SIGNALLER = 
    new LocalSignaling();
    //new DeepstreamSignaling(DEEPSTREAM_URL);
    //new FirebaseSignaling({ // TO DO: fill firebase info
    //    apiKey: FIREBASE_API_KEY,
    //    authDomain: FIREBASE_AUTH_DOMAIN,
    //    projectId: FIREBASE_PROJECT_ID
    //});

export class Pairings {

    private LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    private myUUID: string;

    public constructor() {
        this.myUUID = this.generateRandomLetters(10);
        console.log(this.myUUID);
        setDebug(false);

        /*******************************
         * BIND HTML ELEMENTS & EVENTS *
         *******************************/

        const container = document.querySelector('.container') as HTMLDivElement;
        const btnHostGame = document.querySelector('#btnHostGame') as HTMLButtonElement;
        const btnJoinGame = document.querySelector('#btnJoinGame') as HTMLButtonElement;
        const firstStep = document.querySelector('.firstStep') as HTMLDivElement;
        const hostGame = document.querySelector('.hostGame') as HTMLDivElement;
        const joinGame = document.querySelector('.joinGame') as HTMLDivElement;
        const inputHostUsername = document.querySelector('#inputHostUsername') as HTMLInputElement;
        const btnHost = document.querySelector('#btnHost') as HTMLButtonElement;
        const inputRoomCode = document.querySelector('#inputRoomCode') as HTMLInputElement;
        const inputJoinUsername = document.querySelector('#inputJoinUsername') as HTMLInputElement;
        const btnJoin = document.querySelector('#btnJoin') as HTMLButtonElement;
        const roomCodeLabel = document.querySelector('#roomCodeLabel') as HTMLSpanElement;
        const numPlayersLabel = document.querySelector('#numPlayersLabel') as HTMLSpanElement;
        const numPlayersReadyLabel = document.querySelector('#numPlayersReadyLabel') as HTMLSpanElement;
        const btnReady = document.querySelector('#btnReady') as HTMLButtonElement;
        const waiting = document.querySelector('.waiting') as HTMLDivElement;

        btnHostGame.addEventListener('click', () => {
            firstStep.style.display = 'none';
            hostGame.style.display = 'flex';
        });
        btnJoinGame.addEventListener('click', () => {
            firstStep.style.display = 'none';
            joinGame.style.display = 'flex';
        });
        btnHost.addEventListener('click', () => {
            inputHostUsername.style.borderColor = 'black';
            if (!inputHostUsername.value) {
                inputHostUsername.style.borderColor = 'red';
                return;
            }
            btnHost.disabled = true;
            const roomId = this.generateRandomLetters(4);
            const username = inputHostUsername.value;
            SIGNALLER.hostRoom(roomId, username, this.myUUID);
        });
        btnJoin.addEventListener('click', () => {
            inputRoomCode.style.borderColor = 'black';
            inputJoinUsername.style.borderColor = 'black';
            let error = false;
            if (!inputRoomCode.value) {
                inputRoomCode.style.borderColor = 'red';
                error = true;
            }
            if (!inputJoinUsername.value) {
                inputJoinUsername.style.borderColor = 'red';
                error = true;
            }
            if (error) return;
            btnJoin.disabled = true;
            const roomId = inputRoomCode.value.toUpperCase();
            const username = inputJoinUsername.value;
            SIGNALLER.joinRoom(roomId, username, this.myUUID).then((ok) => {
                if (!ok) {
                    alert('Room does not exists');
                    btnJoin.disabled = false;
                }
            });
        });
        btnReady.addEventListener('click', () => {
            SIGNALLER.upatePlayerStatus(true);
            btnReady.style.display = 'none';
        });

        /*************
         * MESH      *
         *************/

        const meshConfig = new MeshConfig(
            {
                iceServers: [
                    { urls: 'stun:supertorpe.ignorelist.com:16310' },
                    {
                        urls: 'turn:supertorpe.ignorelist.com:16310',
                        username: 'usuario',
                        credential: 'clave',
                    },
                ],
            },
            {
                ordered: false
            },
             1000, // messagesAwaitingReplyMaxSize
            10000, // messagesAwaitingReplyMaxAge
             5000, // messagesAwaitingReplyCleanerInterval
             2000  // checkLatencyInterval
        );

        const mesh = new Mesh(meshConfig, this.myUUID);

        /*************
         * SIGNALING *
         *************/

        let peers: PeerRecord[];

        SIGNALLER.roomRecordEmitter.addEventListener((_uuid, event) => {
            console.log('room info changed: ' + JSON.stringify(event));
            hostGame.style.display = 'none';
            joinGame.style.display = 'none';
            waiting.style.display = 'flex';
            roomCodeLabel.innerHTML = event.roomId;
            numPlayersLabel.innerHTML = event.peers.length.toString();
            numPlayersReadyLabel.innerHTML = event.peers.reduce(
                (total, peer) => (peer.ready ? ++total : total),
                0
            ).toString();
            // all (n > 1) players ready ?
            if (event.peers.length > 1 && event.peers.every((peer) => peer.ready)) {
                SIGNALLER.startPairings(mesh).then((ok) => {
                    if (ok) {
                        peers = event.peers;
                        // If I'm first peer, send the other peers a proposed delta time to start.
                        // If I am not the first peer, wait for the proposal (see (1) below)
                        if (event.peers[0].uuid === this.myUUID) {
                            // wait 2s for clocks synchronization
                            setTimeout(() => {
                                const deltaTimeToStart = 2; // in 2 seconds the game will start
                                const message = new Uint8Array(2);
                                message[0] = 33; // 33 == delta time proposal
                                message[1] = deltaTimeToStart;
                                let peersConfirmed = 0;
                                mesh.broadcastAndListen(message.buffer).forEach((promise) =>
                                    promise.then((reply) => {
                                        peersConfirmed++;
                                        if (peersConfirmed === event.peers.length - 1) {
                                            container.style.display = 'none';
                                            startGame(
                                                event.peers,
                                                mesh,
                                                reply.sourceTimestamp ? reply.sourceTimestamp + deltaTimeToStart * 1000 : 0
                                            );
                                        }
                                    })
                                );
                            }, 2000);
                        }
                    } else {
                        alert('Error while paring players');
                    }
                });
            }
        });

        // (1)
        mesh.messageEmitter.addEventListener((uuid, message) => {
            const info = new Int8Array(message.body);
            if (info[0] === 33) {
                // 33 == delta time proposal
                // send the reply
                const response = new Uint8Array(1);
                response[0] = 34; // 34 == delta time proposal accepted
                mesh.reply(uuid, message, response);
                // calc startTime
                const deltaTimeToStart = info[1];
                container.style.display = 'none';
                startGame(
                    peers,
                    mesh,
                    message.timestampToLocalTime ? message.timestampToLocalTime + deltaTimeToStart * 1000 : 0
                );
            }
        });

        const startGame = (peers: PeerRecord[], mesh: Mesh, timeToStart: number) => {
            console.log(`timeToStart=${timeToStart}`);
            new Phaser.Game({
                parent: 'game-container',
                type: Phaser.AUTO,
                width: 800,
                height: 600,
                pixelArt: true,
                scale: {
                    mode: Phaser.Scale.FIT,
                    autoCenter: Phaser.Scale.CENTER_BOTH,
                },
                physics: {
                    default: 'arcade',
                    arcade: {
                        gravity: { y: 300 },
                        debug: false
                    }
                },
                scene: new MainScene(this.myUUID, peers, mesh, timeToStart)
            });
        };
    }

    private generateRandomLetters(length: number) {
        let code = '';
        for (let i = 0; i < length; i++) {
            const ndx = Math.floor(Math.random() * this.LETTERS.length);
            code += this.LETTERS[ndx];
        }
        return code;
    };

}