const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const Movable = require("../Movable");
const Utils = require("../../../../../Utils");
const Static = require("../../../statics/Static");
const Damage = require("../../../../../gameplay/Damage");
const { Directions, RowColOffsetsByDirection } = require("../../../../../gameplay/Directions");
const EntitiesList = require("../../../../EntitiesList");

class Projectile extends Movable {
    /**
     * @param {Object} config
     * @param {Number} config.row
     * @param {Number} config.col
     * @param {Board} config.board
     * @param {Number} [config.direction="d"]
     * @param {Entity} [config.source=null] An entity that created this projectile. i.e. the character that shot an arrow.
     */
    constructor(config) {
        super(config);

        /**
         * The direction this projectile is facing, and is moving in.
         * @type {String}
         */
        this.direction = config.direction || Directions.DOWN;

        /**
         * An entity that created this projectile. i.e. the character that shot an arrow.
         * @type {Entity}
         */
        this.source = config.source || null;

        /**
         * How many times this entity has moved to another tile.
         * @type {Number}
         */
        this.tilesTravelled = 0;

        let startMoveDelay = this.moveRate;

        // Start the first move of the move loop sooner if it would normally be too long, otherwise
        // the projectile would appear to have an initial pause before moving. Looks weird...
        if (startMoveDelay > 200) {
            startMoveDelay = 200;
        }

        // Start the move loop.
        this.moveLoop = setTimeout(this.move.bind(this), startMoveDelay);

        /**
         * Situational flag. Can be used to stop this from looping after it hits something.
         * @type {Boolean}
         */
        this.canMove = true;
    }

    modDirection(direction) {
        this.direction = direction;
        this.board.emitToNearbyPlayers(
            this.row,
            this.col,
            this.EventsList.change_direction,
            { id: this.id, direction: this.direction },
        );
    }

    onDestroy() {
        this.canMove = false;

        clearTimeout(this.moveLoop);

        super.onDestroy();
    }

    getEmittableProperties(properties) {
        properties.direction = this.direction;
        properties.moveRate = this.moveRate;
        return super.getEmittableProperties(properties);
    }

    move() {
        this.canMove = true;

        if (!this.checkCollisions()) return;

        if (this.canMove === false) {
            this.destroy();
            return;
        }

        const offset = RowColOffsetsByDirection[this.direction];

        // Check the grid row element being accessed is valid.
        if (this.board.grid[this.row + offset.row] === undefined) {
            this.destroy();
            return;
        }

        // Check the grid col element (the tile itself) being accessed is valid.
        if (this.board.grid[this.row + offset.row][this.col + offset.col] === undefined) {
            this.destroy();
            return;
        }

        // Increase the amount of tiles this entity has moved.
        this.tilesTravelled += 1;

        if (this.tilesTravelled >= this.range) {
            this.destroy();
            return;
        }

        // Move the entity.
        super.move(offset.row, offset.col);

        // Prevent the loop from repeating if it has been destroyed by calling .move above, or any
        // subsequent .postMove functionality, such as checking if it now collides with anything on
        // the board tile it moved to.
        if (this._destroyed) return;

        this.moveLoop = setTimeout(this.move.bind(this), this.moveRate);
    }

    postMove() {
        this.checkCollisions();

        super.postMove();
    }

    /**
     * Checks if the entity collided with can be hit by any of the damage types this projectile deals.
     * @param {Entity} entity
     */
    canDamageTypeCollideWithTarget(entity) {
        // Check the entity is immune to anything.
        if (entity.damageTypeImmunities) {
            // Check every type of this damage.
            for (const type of this.damageTypes) {
                // If the entity is immune to the current type, check the net one.
                if (entity.damageTypeImmunities.includes(type)) {
                    continue;
                }
                // Entity is not immune to this damage type, they can be affected.
                return true;
            }
        }
        else {
            return true;
        }
        return false;
    }

    /**
     * Check for collisions between high blocking statics, and destroyables.
     */
    checkCollisions() {
        if (!this.shouldContinueCheckCollisionsChain()) return false;

        /** @type {BoardTile} */
        const currentBoardTile = this.getBoardTile();

        // Check if it is over any other destroyables.
        let destroyable;
        for (const dynamicKey in currentBoardTile.destroyables) {
            if (currentBoardTile.destroyables.hasOwnProperty(dynamicKey) === false) continue;

            destroyable = currentBoardTile.destroyables[dynamicKey];

            // Don't check against itself.
            if (destroyable === this) continue;
            // Don't check against source.
            if (destroyable === this.source) continue;

            // Pass through if none of the damage applies to this entity.
            if (this.canDamageTypeCollideWithTarget(destroyable) === false) continue;

            // Check both entities are still on the board, as they might have been removed in the
            // previous handleCollision if there are multiple destroyables stacked on the same tile.
            // They shouldn't be able to interact with each other if one of them isn't on the board (i.e. destroyed).
            if (!this.board) break;
            if (destroyable.board) this.handleCollision(destroyable);
        }

        // Check if it is over an interactable.
        if (currentBoardTile.static !== null) {
            if (currentBoardTile.static.activeState !== undefined) {
                // Check this projectile is still on the board, as it might have been removed above if it hit something.
                if (this.board) {
                    this.handleCollision(currentBoardTile.static);
                }
            }
        }

        // Check if this projectile is currently over something that blocks high things, including interactables, solids, walls, etc.
        if (currentBoardTile.isHighBlocked() === true) {
            this.destroy();
        }

        return this.shouldContinueCheckCollisionsChain();
    }

    shouldContinueCheckCollisionsChain() {
        // Should the chain of checkCollisions calls be continued.
        return this.board !== null;
    }

    /**
     * Called when this projectile hits something.
     * @param {Entity} collidee - The entity that this projectile collided with.
     */
    handleCollision(collidee) {
        this.damageCollidee(collidee);
    }

    /**
     * Check any conditions that should always be checked when this projectile hits something.
     * @param {Entity} collidee - The entity that this projectile collided with.
     */
    mandatoryCollideeChecks(collidee) {
        // Add this to the default checks that get done when any projectile moves, as
        // the case where a wind moves into a projectile is covered by the wind itself,
        // but not when the other projectile is the one moving into the wind during its own move.
        if (collidee instanceof EntitiesList.ProjWind
            || collidee instanceof EntitiesList.ProjSuperWind) {
            // If 2 winds collide, destroy them both.
            if (this instanceof EntitiesList.ProjWind
                || this instanceof EntitiesList.ProjSuperWind) {
                this.destroy();
                collidee.destroy();
            }
            else {
                collidee.pushBackCollidee(this);
            }
        }

        if (collidee instanceof Static) {
            // Destroy if there is something like a wall in the way.
            // Can still pass through things like gates and fences.
            if (collidee.isHighBlocked() === true) this.destroy();
        }
    }

    /**
     * Called when this projectile hits something.
     * @param {Entity} collidee - The entity that this projectile collided with.
     */
    damageCollidee(collidee) {
        // Check any of the conditions that should always be checked.
        this.mandatoryCollideeChecks(collidee);

        // Should damage be dealt after below conditions are applied.
        let dealDamage = true;
        let { damageAmount } = this;

        // Can the collidee be damaged.
        if (collidee.hitPoints === null) dealDamage = false;
        // Does this projectile deal any damage.
        if (damageAmount === 0) dealDamage = false;
        // Does this projectile hit low blocking statics?
        if (this.collisionType === this.CollisionTypes.Melee) {
            if (collidee instanceof Static) {
                // Only damage the static (if it is an interactable) and destroy this projectile when it hits a blocking static,
                // as it might hit a non-blocking one such as an open door or cut down tree, but it should still pass through them.
                if (collidee.isLowBlocked() === false) dealDamage = false;
            }
        }
        else if (collidee instanceof Static) {
            if (collidee.isHighBlocked() === false) dealDamage = false;
        }

        if (this.hasBackStabBonus === true) {
            if (collidee instanceof EntitiesList.AbstractClasses.Character) {
                // If attacked from behind, apply bonus damage.
                if (collidee.direction === this.direction) damageAmount = this.damageAmount * 5;
            }
        }

        if (this.canDamageTypeCollideWithTarget(collidee) === false) {
            // TODO: test this with other damage types, havent tried with immunities
            // console.log("projectile.js damagecollidee, immune to all damage types, take no damage");
            damageAmount = 0;
        }

        if (dealDamage === true) {
            // Don't cause self-damage for whoever created this projectile.
            if (collidee === this.source) return;

            collidee.damage(
                new Damage({
                    amount: damageAmount,
                    types: this.damageTypes,
                    armourPiercing: this.damageArmourPiercing,
                }),
                this.source,
            );

            this.destroy();
        }
    }

    /**
     * Push back the thing that this entity collided with.
     * @param {Entity} collidee
     * @param {Number} tileCount - How far in tiles to push.
     */
    pushBackCollidee(collidee, tileCount) {
        // Check any of the conditions that should always be checked.
        this.mandatoryCollideeChecks(collidee);

        if (!this.board) return;
        if (!collidee.board) return;

        if (collidee instanceof EntitiesList.AbstractClasses.Character) {
            const offset = RowColOffsetsByDirection[this.direction];
            collidee.modDirection(this.direction);

            if (tileCount > 0) {
                // Clear their current move loop so they don't end up with 2 loops after doing this direct movement. Only affects mobs.
                clearTimeout(collidee.moveLoop);

                for (let i = 0; i < tileCount; i += 1) {
                    // Check the collidee is still on the board each iteration, as it might have
                    // been removed in a previous push (i.e. mob dies being pushed into a hazard).
                    if (collidee.board) {
                        collidee.push(offset.row, offset.col);
                    }
                }
            }

            this.destroy();
            return;
        }
        if (collidee instanceof Projectile) {
            collidee.modDirection(this.direction);
            // Reset the amount of tiles the other projectile has travelled, so it can go it's max distance again in the other direction.
            collidee.tilesTravelled = 0;
            // Make the other projectile belong to the source of this one, so it damages them when reflected back at them.
            collidee.source = this.source;
            this.destroy();
        }
    }

    static createClasses() {
        try {
            // Load all of the resource node configs.
            const configs = yaml.safeLoad(
                fs.readFileSync(
                    path.resolve("./src/configs/Projectiles.yml"), "utf8",
                ),
            );

            configs.forEach((config) => {
                // Only generate a class for this entity if one doesn't already
                // exist, as it might have it's own special logic file.
                if (!EntitiesList[`Proj${config.name}`]) {
                    // Use the base Projectile class to extend from.
                    class GenericProjectile extends Projectile { }

                    GenericProjectile.registerEntityType();

                    EntitiesList[`Proj${config.name}`] = GenericProjectile;
                }
            });
        }
        catch (error) {
            Utils.error(error);
        }
    }

    static loadConfigs() {
        try {
            const projConfigs = yaml.safeLoad(
                fs.readFileSync(
                    path.resolve("./src/configs/Projectiles.yml"), "utf8",
                ),
            );

            projConfigs.forEach((config) => {
                const EntityType = EntitiesList[`Proj${config.name}`];
                // Check the projectile entity type is valid.
                if (!EntityType) {
                    Utils.error("Invalid projectile config. Entity type of name not found:", config);
                }

                Object.entries(config).forEach(([key, value]) => {
                    if (key === "collisionType") {
                        if (!Projectile.prototype.CollisionTypes[value]) {
                            Utils.error("Invalid collision type. Check it is in the collision types list:", config);
                        }

                        value = Projectile.prototype.CollisionTypes[value];
                    }

                    if (key === "damageAmount") {
                        if (value < 1) {
                            Utils.error("Invalid damage amount. Must be 1 or greater.");
                        }
                    }

                    if (key === "damageTypes") {
                        value = value.map((damageTypeName) => {
                            if (!Damage.Types[damageTypeName]) {
                                Utils.error("Invalid damage type. Check it is in the damage types list:", config);
                            }
                            return Damage.Types[damageTypeName];
                        });
                    }

                    if (key === "damageArmourPiercing") {
                        if (value < 1 || value > 100) {
                            Utils.error("Invalid armour piercing amount. Must be from 1 to 100.");
                        }
                    }

                    if (key === "healAmount") {
                        if (value < 1) {
                            Utils.error("Invalid heal amount. Must be 1 or greater.");
                        }
                    }

                    // Load whatever properties that have the same key in the config as on this class.
                    if (EntityType.prototype[key] !== undefined) {
                        // Check if the property has already been loaded by a
                        // subclass, or set on the class prototype for class files.
                        if (Object.getPrototypeOf(EntityType).prototype[key]
                        === EntityType.prototype[key]) {
                            EntityType.prototype[key] = value;
                        }
                    }
                });
            });
        }
        catch (error) {
            Utils.error(error);
        }
    }
}
module.exports = Projectile;

Projectile.abstract = true;

/**
 * How many board tiles can this projectile can move before it is destroyed.
 * @type {Number}
 */
Projectile.prototype.range = "Projectile range not set";

/**
 * How much damage this projectile will deal when it hits something.
 * @type {Number}
 */
Projectile.prototype.damageAmount = 0;

/**
 * The types of damage this projectile will deal when it hits something.
 * @type {Array.<Number>}
 */
Projectile.prototype.damageTypes = [Damage.Types.Physical];

/**
 * What percentage of armour this projectile will ignore when dealing damage.
 * 0 = 0%, 100 = 100%, etc.
 * @type {Number}
 * @default
 */
Projectile.prototype.damageArmourPiercing = 0;

/**
 * How many hitpoints this projectile will restore when it hits something.
 * @type {Number}
 */
Projectile.prototype.healAmount = 0;

/**
 * How often this projectile moves along its path, in ms.
 * @type {Number}
 */
Projectile.prototype.moveRate = 500;

/**
 * How many tiles this projectile can travel before it is destroyed.
 * @type {Number}
 */
Projectile.prototype.range = 5;

/**
 * Valid types to use for collisionType.
 * @type {{Melee: number, Ranged: number}}
 */
Projectile.prototype.CollisionTypes = {
    Melee: 1,
    Ranged: 2,
};

/**
 * What kind of damage does this projectile deal.
 * Used to determine if low blocking statics should be damaged,
 * instead of the projectile just passing over/through them.
 * @type {Number}
 */
Projectile.prototype.collisionType = Projectile.prototype.CollisionTypes.Ranged;

/**
 * Whether this projectile deals bonus damage when it hits a character from behind.
 * @type {Boolean}
 */
Projectile.prototype.hasBackStabBonus = false;
