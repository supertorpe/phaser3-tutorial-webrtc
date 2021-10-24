# phaser3-tutorial-webrtc
Phaser 3 Multiplayer p2p (WebRTC) demo

## Features

This is a proof of concept to see the feasibility of creating p2p HTML5 multiplayer games on a mesh network.

The communication between the browsers is done through WebRTC.

The signaling is done with deepstream.io or firebase (even with the LocalStorage during development).

Comment and uncomment the lines in src/pairings.ts to establish the desired signaling:

```js
///// SIGNALIGN MECHANISM /////
// Comment/Uncomment the desired signalling mechanism
// Local: for development ----------------------
//*
import { LocalSignaling } from 'mplaynet';
const SIGNALLER = new LocalSignaling();
//*/
// Deepstream ----------------------
/*
import { DeepstreamSignaling } from 'mplaynet/deepstream';
const SIGNALLER = new DeepstreamSignaling("wss://HOST:PORT");
//*/
// Firebase ----------------------
/*
import 'firebase/compat/firestore';
import { FirebaseSignaling } from 'mplaynet/firebase';
const SIGNALLER = new FirebaseSignaling({ // TO DO: fill firebase info
        apiKey: API_KEY,
        authDomain: AUTH_DOMAIN,
        projectId: PROJECT_ID
    });
//*/
```
If you choose deepstream or firebase, fill in the connection details

All the management of the mesh network (signaling, connections, sending / receiving messages) is encapsulated into [mplaynet](https://github.com/supertorpe/mplaynet).

Once the signaling has finished and the connections have been established, all traffic goes directly between the browsers.

The peers are synchronized and agree on the game start time.

Once the game starts, the time is divided into slices (e.g. 100ms).

Each peer broadcast its commands -its keystrokes-, indicating the slice to which they belong. As the commands of the other players arrive from the network, they are stored in a buffer.

Each slice corresponds to a game state (world and objects from planckjs, scoreboard and commands -local and remote-).
Before calculating the next game state, the command buffer is traversed to assign them to the corresponding game state.

To calculate the next game state, It clones the current game state and physics is calculated applying the commands.

A list of the n-last slices is stored in memory.

If commands arrive from a slice prior to the current one, the history of the game states is recalculated from that slice on. Thus, all peers keep game state synchronized, despite latency.

You can configure the slice that is rendered. If it is not the latest, the rendering can interpolate between the current state and the next.

If you change the tab or minimize the browser, the gameloop stops, but the commands continue to be received over the network. When you reactivate the tab, the history of the game states of that lost period is reconstructed, thereby resynchronizing the game.

## MultiplayerScene

The logic of game state management, history rewriting, etc. it is encapsulated in the MultiplayerScene class.

The GameStates contain meta information such as the slice, physics world and bodies... and an "info" field that is left open so that the scene includes what it needs (e.g. scores).

The logic of the game is implemented in a class which inherits from MultiplayerScene.

Considerations for scenes inheriting from MultiplayerScene:

They must implement the methods:

- **constructor(peers, mesh, timeToStart)**: it must receive the array of peers, the mesh network and the future timestamp in which we want the game to start

- **sceneCreate()**: Here you write everything you would do in your "create ()".

Further, we must:
    - Phaser objects for which we want interpolation: **phaserObject.interpolate = true;**
    - return a GameState object **{ world: _arcade_world_, info: _extra_info_, }** where _extra_info_ is the info we want to store into the game state not related to physics bodies, like scores... 

- **newGameState(prevState, newState, rewritingHistory)**: invoked when a new game state is being created, before calculating the physics.

Here it would be necessary to hook the colliders and perform treatment that depends exclusively on the previous state. The last parameter indicates whether it is being invoked within the history rewrite loop.

- **computePhysics(body, command)**: here you have to apply the physics to the body depending on the command

- **readCommand()**: reads the input method (e.g. keyboard) to generate and return a numeric value that represents it.
Special value 0 is "no command"

- **render(gameState)**: rendering of phaser objects associated with physics body objects is automatic. The rest of the elements are rendered here (e.g. scores)

- **cloneGameStateInfo(info)**: clones the game state info that is specific to the scene

## The game

The game is the phaser 3 starter tutorial.

[You can play the demo here (in localhost)](https://supertorpe.github.io/phaser3-tutorial-webrtc)