import Merchant from "./Merchant";
import NPCShopTypes from "../../../catalogues/NPCShopTypes.json";

class Entity extends Merchant {
    constructor(x, y, config) {
        config.displayName = "Omni merchant";
        super(x, y, config);

        this.npcShopType = NPCShopTypes.Omni;
    }
}

export default Entity;
