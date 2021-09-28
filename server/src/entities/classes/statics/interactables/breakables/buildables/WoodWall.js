const Buildable = require("./Buildable");

class WoodWall extends Buildable {
    /**
     * @param {Object} config
     * @param {Number} config.row
     * @param {Number} config.col
     * @param {Board} config.board
     * @param {Clan} config.clan
     */
    constructor(config) {
        super(config);

        // this.clan = config.clan;
        // this.clan.addStructure(this);
    }
}
module.exports = WoodWall;

WoodWall.prototype.hitPoints = 500;
WoodWall.prototype.maxHitPoints = WoodWall.prototype.hitPoints;
