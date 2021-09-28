import dungeonz from "../../../shared/Global";
import gameConfig from "../../../shared/GameConfig";
import Container from "../Container";

class Entity extends Container {
    constructor(x, y, config) {
        super(x, y);

        this.setScale(gameConfig.GAME_SCALE);

        this.baseSprite = dungeonz.gameScene.add.sprite(0, 0, "game-atlas", "wood-wall");
        this.baseSprite.setOrigin(0.5);
        this.add(this.baseSprite);
    }
}

export default Entity;
