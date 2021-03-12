const Mob = require("../Mob");

class Merchant extends Mob {
    /**
     * Prevent merchants from ever being moved.
     */
    move() {}

    /**
     * Prevent merchants from ever being killed.
     */
    modHitPoints() {}

    modDirection() {}

    addStatusEffect() {}
}

Merchant.abstract = true;

Merchant.prototype.maxHitPoints = 1;
Merchant.prototype.gloryValue = 0;
Merchant.prototype.faction = Mob.prototype.Factions.Citizens;
Merchant.prototype.shop = undefined;

module.exports = Merchant;
