export class WorldCloner {

    public clone(world: Phaser.Physics.Arcade.World): Phaser.Physics.Arcade.World {

        const worldConfig = {
            fps: world.fps,
            fixedStep: world.fixedStep,
            timeScale: world.timeScale,
            gravity: world.gravity.clone(),
            x: world.bounds.x,
            y: world.bounds.y,
            width: world.bounds.width,
            height: world.bounds.height,
            checkCollision: {
                up: world.checkCollision.up,
                down: world.checkCollision.down,
                left: world.checkCollision.left,
                right: world.checkCollision.right
            },
            overlapBias: world.OVERLAP_BIAS,
            tileBias: world.TILE_BIAS,
            forceX: world.forceX,
            isPaused: world.isPaused,
            debug: world.drawDebug,
            debugShowBody: world.defaults.debugShowBody,
            debugShowStaticBody: world.defaults.debugShowStaticBody,
            debugShowVelocity: world.defaults.debugShowVelocity,
            debugBodyColor: world.defaults.staticBodyDebugColor,
            debugVelocityColor: world.defaults.velocityDebugColor,
            maxEntries: world.maxEntries,
            useTree: world.useTree
        };

        let result = new Phaser.Physics.Arcade.World(world.scene, worldConfig);

        // bodies
        world.bodies.iterate((body) => {
            result.bodies.set(this.cloneBody(result, body));
        });

        // staticBodies
        world.staticBodies.iterate((body) => {
            result.staticBodies.set(this.cloneStaticBody(result, body));
        });

        // pendingDestroy
        world.pendingDestroy.iterate((body) => {
            result.pendingDestroy.set(this.cloneStaticOrDynamicBody(result, body));
        });

        // treeMinMax
        result.treeMinMax = {
            minX: world.treeMinMax.minX,
            minY: world.treeMinMax.minY,
            maxX: world.treeMinMax.maxX,
            maxY: world.treeMinMax.maxY
        };

        // colliders
        /*
                world.colliders.update();
                world.colliders.getActive().forEach((collider) => {
                    result.addCollider(
                        this.cloneColliderObject(collider.object1),
                        this.cloneColliderObject(collider.object2),
                        collider.collideCallback,
                        collider.processCallback,
                        collider.callbackContext
                    );
                });
        //*/
        // OTHERS: _elapsed, stepsLastFrame, _total, _tempMatrix, _tempMatrix2

        return result;

    }

    public cloneBody(world: Phaser.Physics.Arcade.World, body: Phaser.Physics.Arcade.Body): Phaser.Physics.Arcade.Body {
        // Clone GameObject ???
        const result = new Phaser.Physics.Arcade.Body(world, body.gameObject);

        result.acceleration = body.acceleration.clone();
        result.allowDrag = body.allowDrag;
        result.allowGravity = body.allowGravity;
        result.allowRotation = body.allowRotation;
        result.angle = body.angle;
        result.angularAcceleration = body.angularAcceleration;
        result.angularDrag = body.angularDrag;
        result.angularVelocity = body.angularVelocity;
        result.blocked = {
            none: body.blocked.none,
            up: body.blocked.up,
            down: body.blocked.down,
            left: body.blocked.left,
            right: body.blocked.right
        };
        //result.bottom => this.position.y + this.height
        result.bounce = body.bounce.clone();
        result.center = body.center.clone();
        result.checkCollision = {
            none: body.checkCollision.none,
            up: body.checkCollision.up,
            down: body.checkCollision.down,
            left: body.checkCollision.left,
            right: body.checkCollision.right
        };
        result.collideWorldBounds = body.collideWorldBounds;
        result.customBoundsRectangle = new Phaser.Geom.Rectangle(body.customBoundsRectangle.x, body.customBoundsRectangle.y, body.customBoundsRectangle.width, body.customBoundsRectangle.height);
        result.customSeparateX = body.customSeparateX;
        result.customSeparateY = body.customSeparateY;
        result.debugBodyColor = body.debugBodyColor;
        result.debugShowBody = body.debugShowBody;
        result.debugShowVelocity = body.debugShowVelocity;
        result.deltaMax = body.deltaMax.clone();
        result.drag = body.drag.clone();
        result.embedded = body.embedded;
        result.enable = body.enable;
        result.facing = body.facing;
        result.friction = body.friction.clone();
        result.gravity = body.gravity.clone();
        result.halfHeight = body.halfHeight;
        result.halfWidth = body.halfWidth;
        result.immovable = body.immovable;
        result.isCircle = body.isCircle;
        result.mass = body.mass;
        result.maxAngular = body.maxAngular;
        result.maxSpeed = body.maxSpeed;
        result.maxVelocity = body.maxVelocity.clone();
        result.moves = body.moves;
        result.offset = body.offset.clone();
        result.onCollide = body.onCollide;
        result.onOverlap = body.onOverlap;
        result.onWorldBounds = body.onWorldBounds;
        result.overlapR = body.overlapR;
        result.overlapX = body.overlapX;
        result.overlapY = body.overlapY;
        result.position = body.position.clone();
        result.preRotation = body.preRotation;
        result.prev = body.prev.clone();
        result.prevFrame = body.prevFrame.clone();
        result.pushable = body.pushable;
        result.radius = body.radius;
        result.rotation = body.rotation;
        result.sourceHeight = body.sourceHeight;
        result.sourceWidth = body.sourceWidth;
        result.speed = body.speed;
        result.syncBounds = body.syncBounds;
        result.touching = {
            none: body.touching.none,
            up: body.touching.up,
            down: body.touching.down,
            left: body.touching.left,
            right: body.touching.right
        };
        // TO DO transform
        result.useDamping = body.useDamping;
        result.velocity = body.velocity.clone();
        result.wasTouching = {
            none: body.wasTouching.none,
            up: body.wasTouching.up,
            down: body.wasTouching.down,
            left: body.wasTouching.left,
            right: body.wasTouching.right
        };
        if (body.worldBounce !== null) result.worldBounce = body.worldBounce.clone();
        result.x = body.x;
        result.y = body.y;

        return result;
    }

    public cloneStaticBody(world: Phaser.Physics.Arcade.World, body: Phaser.Physics.Arcade.StaticBody): Phaser.Physics.Arcade.StaticBody {
        // Clone GameObject ???
        const result = new Phaser.Physics.Arcade.StaticBody(world, body.gameObject);

        result.blocked = {
            none: body.blocked.none,
            up: body.blocked.up,
            down: body.blocked.down,
            left: body.blocked.left,
            right: body.blocked.right
        };
        result.center = body.center.clone();
        result.checkCollision = {
            none: body.checkCollision.none,
            up: body.checkCollision.up,
            down: body.checkCollision.down,
            left: body.checkCollision.left,
            right: body.checkCollision.right
        };
        result.customSeparateX = body.customSeparateX;
        result.customSeparateY = body.customSeparateY;
        result.debugBodyColor = body.debugBodyColor;
        result.debugShowBody = body.debugShowBody;
        result.embedded = body.embedded;
        result.enable = body.enable;
        result.halfHeight = body.halfHeight;
        result.halfWidth = body.halfWidth;
        result.height = body.height;
        result.immovable = body.immovable;
        result.isCircle = body.isCircle;
        result.mass = body.mass;
        result.onCollide = body.onCollide;
        result.onOverlap = body.onOverlap;
        result.overlapR = body.overlapR;
        result.overlapX = body.overlapX;
        result.overlapY = body.overlapY;
        result.physicsType = body.physicsType;
        result.position = body.position.clone();
        result.pushable = body.pushable;
        result.radius = body.radius;
        result.touching = {
            none: body.touching.none,
            up: body.touching.up,
            down: body.touching.down,
            left: body.touching.left,
            right: body.touching.right
        };
        result.wasTouching = {
            none: body.wasTouching.none,
            up: body.wasTouching.up,
            down: body.wasTouching.down,
            left: body.wasTouching.left,
            right: body.wasTouching.right
        };
        result.width = body.width;
        result.x = body.x;
        result.y = body.y;

        return result;
    }

    public cloneStaticOrDynamicBody(world: Phaser.Physics.Arcade.World, body: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody): Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody {
        if (body instanceof Phaser.Physics.Arcade.Body) return this.cloneBody(world, body);
        else return this.cloneStaticBody(world, body);
    }

    public cloneColliderObject(obj: Phaser.Types.Physics.Arcade.ArcadeColliderType): Phaser.Types.Physics.Arcade.ArcadeColliderType {
        let result: Phaser.Types.Physics.Arcade.ArcadeColliderType;

        if (obj instanceof Phaser.GameObjects.Group) {
            result = new Phaser.GameObjects.Group(
                obj.scene,
                obj.children.getArray() // TO DO: clone children Phaser.Structs.Set<Phaser.GameObjects.GameObject>
                // TO DO: set config
            );
        } else {
            result = obj;
            // TO DO clone the other types:
            // Phaser.GameObjects.GameObject
            // Phaser.Physics.Arcade.Sprite
            // Phaser.Physics.Arcade.Image
            // Phaser.Physics.Arcade.StaticGroup
            // Phaser.Physics.Arcade.Group 
            // Phaser.Tilemaps.TilemapLayer
            // Phaser.GameObjects.GameObject[]
            // Phaser.Physics.Arcade.Sprite[]
            // Phaser.Physics.Arcade.Image[]
            // Phaser.Physics.Arcade.StaticGroup[]
            // Phaser.Physics.Arcade.Group[]
            // Phaser.Tilemaps.TilemapLayer[]
        }
        return result;
    }



}