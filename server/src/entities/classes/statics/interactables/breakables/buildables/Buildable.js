const Breakable = require("../Breakable");

class Buildable extends Breakable {
    /**
     * @param {Object} config
     * @param {Number} config.row
     * @param {Number} config.col
     * @param {Board} config.board
     * @param {Number} [config.activeState = true] - Whether this entity is already active when created.
     */
    constructor(config) {
        super(config);
        // Buildables are special entities that occupy the static slot of the tile they are on, like a
        // normal static, but are also added to the destroyables list so they can be sent dynamically.
        config.board.addStatic(this);
        config.board.addDestroyable(this);

        /**
         * Whether this buildable entity is ready to be interacted with.
         * @type {Boolean}
         */
        this.activeState = true;
        if (config.activeState !== undefined) this.activeState = config.activeState;
    }

    onAllHitPointsLost() {
        // Prevent multiple destruction of entities.
        if (this._destroyed === true) return;

        this._destroyed = true;

        // The buildable might be waiting to reactive when destroyed. Deal with the timeout that would fire.
        clearTimeout(this.reactivationTimer);

        // If this belonged to a clan, remove this from it.
        if (this.clan !== null) {
            this.clan.removeStructure(this);
        }

        // Tell nearby players to remove this buildable entity.
        this.board.emitToNearbyPlayers(this.row, this.col, this.EventsList.remove_entity, this.id);

        this.board.removeStatic(this);
        this.board.removeDestroyable(this);
    }

    getEmittableProperties(properties) {
        properties.id = this.id;
        properties.typeNumber = this.typeNumber;
        if (this.activeState !== undefined) {
            properties.activeState = this.activeState;
        }
        return super.getEmittableProperties(properties);
    }

    /**
     * @param {Character} interactedBy
     * @param {Item} toolUsed
     */
    interaction(interactedBy, toolUsed) {
        // console.log("* WARNING: Buildable entity type defined without overriding Buildable.interaction:", this.typeNumber);
    }

    activate() {
        let blocked = true;

        // Check if there are any other properties on the destroyables object.
        // Need to do this instead of BoardTile.containsAnyDestroyables as this entity itself is
        // also a destroyable (and a static).
        const boardTile = this.getBoardTile();
        if (Object.keys(boardTile.destroyables).length === 1) blocked = false;

        // Check there are no obstructions on the object before activating it.
        if (blocked === false) {
            // Nothing in the way. Reactivate this object.
            this.activeState = true;

            // Tell any nearby players that this object can now be interacted with.
            this.board.emitToNearbyPlayers(
                this.row,
                this.col,
                this.EventsList.interactable_state,
                { id: this.id, state: this.activeState },
            );
        }
        // Something in the way.
        else {
            // Restart the timer to activate this object.
            this.reactivationTimer = setTimeout(
                this.activate.bind(this),
                this.reactivationRate || 5000, // Use some time in case it is null.
            );
        }
    }

    deactivate() {
        this.activeState = false;

        // If a reactivation rate is set, start a timer to reactivate this object.
        if (this.reactivationRate !== null) {
            this.reactivationTimer = setTimeout(this.activate.bind(this), this.reactivationRate);
        }

        // Tell any nearby players that this object has been interacted with.
        this.board.emitToNearbyPlayers(
            this.row,
            this.col,
            this.EventsList.interactable_state,
            { id: this.id, state: this.activeState },
        );
    }
}
module.exports = Buildable;

Buildable.prototype.blocking = true;

/**
 * If set, this entity is a clan structure, and this is a reference to that clan.
 * @type {Clan}
 */
Buildable.prototype.clan = null;
