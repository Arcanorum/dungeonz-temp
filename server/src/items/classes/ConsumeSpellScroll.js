const Item = require("./Item");
const ModHitPointConfigs = require("../../gameplay/ModHitPointConfigs");
const Heal = require("../../gameplay/Heal");

class ConsumeSpellScroll extends Item {
    onUsed() {
        this.owner.board.getTilesInEntityRange(this.owner, 1).forEach((boardTile) => {
            Object.values(boardTile.destroyables).forEach((destroyable) => {
                // For every destroyable on that tile.

                if (destroyable instanceof this.EntitiesList.AbstractClasses.Zombie === false) {
                    return;
                }

                if (destroyable.master === this.owner) {
                    // Consume the minion.
                    destroyable.destroy();
                    this.owner.heal(new Heal(ModHitPointConfigs.ConsumeSpellScroll.healAmount));
                }
            });
        });

        super.onUsed();
    }
}

module.exports = ConsumeSpellScroll;
