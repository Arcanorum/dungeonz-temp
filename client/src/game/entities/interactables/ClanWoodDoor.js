import dungeonz from "../../../shared/Global";
import gameConfig from "../../../shared/GameConfig";
import Container from "../Container";

class Entity extends Container {
    constructor(x, y, config) {
        super(x, y);

        this.setScale(gameConfig.GAME_SCALE);

        this.baseSprite = dungeonz.gameScene.add.sprite(0, 0, "game-atlas", this.activeStateFrame);
        this.baseSprite.setOrigin(0.5);
        this.add(this.baseSprite);

        if (!config.activeState) {
            this.baseSprite.setFrame(this.inactiveStateFrame);
        }
    }

    updateState(state) {
        if (state) {
            this.baseSprite.setFrame(this.activeStateFrame);
        }
        else {
            this.baseSprite.setFrame(this.inactiveStateFrame);
        }
    }
}

Entity.prototype.activeStateFrame = "wood-door";
Entity.prototype.inactiveStateFrame = "wood-door-inactive";

export default Entity;
