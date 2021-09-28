const Holdable = require("../holdable/Holdable");

class WoodWall extends Holdable {
    checkUseCriteria(direction) {
        // Place the charter in front of the player to create a clan.
        const frontOffset = this.owner.board.getRowColInFront(
            direction,
            this.owner.row,
            this.owner.col,
        );

        // Check there is nothing in the way.
        if (!this.owner.board.isTileBuildable(frontOffset.row, frontOffset.col)) return false;

        return super.checkUseCriteria();
    }

    onUsed(direction) {
        // Check this player is in a clan.
        // if (this.owner.clan === null) {
        //     // Tell them they must be in a clan to build.
        //     this.owner.socket.sendEvent(this.owner.EventsList.chat_warning, this.owner.ChatWarnings["No clan build warning"]);
        //     return;
        // }

        // Place the charter in front of the player to create a clan.
        const frontOffset = this.owner.board.getRowColInFront(
            direction,
            this.owner.row,
            this.owner.col,
        );

        // Check it would be within range of the charter and max structures isn't reached.
        // if (this.owner.clan.canBuild(
        //     frontOffset.row,
        //     frontOffset.col,
        //     this.owner.board,
        // ) === false) return;

        new this.EntitiesList.WoodWall({
            row: frontOffset.row,
            col: frontOffset.col,
            board: this.owner.board,
        }).emitToNearbyPlayers();

        super.onUsed();
    }
}

module.exports = WoodWall;
