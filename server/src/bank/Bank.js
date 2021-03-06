const settings = require("../../settings.js");
const EventsList = require("../EventsList.js");
const ItemConfig = require("../inventory/ItemConfig.js");
const BankChest = require("../entities/classes/statics/interactables/breakables/BankChest");
const starterBankItemConfigsList = require("./StarterBankItemConfigs").list;
const Utils = require("../Utils.js");
const ItemsList = require("../items/ItemsList.js");

class Bank {
    constructor(owner) {
        this.owner = owner;

        this.weight = 0;

        this.maxWeight = settings.MAX_BANK_WEIGHT || 1000;

        this.updateMaxWeightUpgradeCost();

        /**
         * A list of the items in this bank account.
         * Only contains item configs for potential items, NOT actual Item class instances,
         * as they cannot be used, equipped etc. directly while in the bank.
         * @type {Array.<ItemConfig>}
         */
        this.items = [];
    }

    loadData(account) {
        // Add the stored items to this player's bank.
        account.bankItems.forEach((bankItem) => {
            try {
                let itemConfig;

                // Check the type of item to add is valid.
                // Might have been removed since this player last logged in.
                if (!bankItem || !ItemsList.BY_CODE[bankItem.typeCode]) {
                    // Give them something else instead so the slot indexes don't get messed up.
                    itemConfig = new ItemConfig({
                        ItemType: ItemsList.BY_NAME.GloryOrb,
                    });
                }
                else {
                    // Make new item config instances based on the stored data.
                    itemConfig = new ItemConfig({
                        ItemType: ItemsList.BY_CODE[bankItem.typeCode],
                        quantity: bankItem.quantity,
                        durability: bankItem.durability,
                        maxDurability: bankItem.maxDurability,
                    });
                }

                // Store the item config in the bank.
                this.items.push(itemConfig);
            }
            catch (error) {
                Utils.warning(error.message);
            }
        });

        // Calculate the max weight, including any upgrades they have bought.
        this.modMaxWeight(
            (account.bankUpgrades || 0) * (settings.ADDITIONAL_MAX_BANK_WEIGHT_PER_UPGRADE || 0),
        );

        this.updateWeight();
    }

    /**
     * Returns all of the items in the format to be saved to the player account.
     * Used to do the initial save for new player accounts, otherwise the in memory document doesn't
     * have the items they have picked up before creating the account, so they won't be saved.
     * @returns {Array}
     */
    getSaveData() {
        // Check for any invalid items before saving.
        return this.items.map((item) => ({
            typeCode: item.ItemType.prototype.typeCode,
            quantity: item.quantity,
            durability: item.durability,
            maxDurability: item.maxDurability,
        }));
    }

    print() {
        Utils.message("Printing bank:");
        this.items.forEach((item) => {
            console.log(item);
        });
    }

    pushItem(itemConfig, sendEvent, skipSave) {
        const slotIndex = this.items.length;

        this.items.push(itemConfig);

        // Tell the player a new item was added to their bank.
        if (sendEvent) {
            this.owner.socket.sendEvent(EventsList.add_bank_item, {
                slotIndex,
                typeCode: itemConfig.ItemType.prototype.typeCode,
                id: itemConfig.id,
                quantity: itemConfig.quantity,
                durability: itemConfig.durability,
                maxDurability: itemConfig.maxDurability,
                totalWeight: itemConfig.totalWeight,
            });
        }

        // If this player has an account, save the new bank item level.
        if (!skipSave && this.owner.socket.account) {
            try {
                // Need to use Mongoose setter when modifying array by index directly.
                // https://mongoosejs.com/docs/faq.html#array-changes-not-saved
                this.owner.socket.account.bankItems.set(slotIndex, {
                    typeCode: itemConfig.ItemType.prototype.typeCode,
                    quantity: itemConfig.quantity,
                    durability: itemConfig.durability,
                    maxDurability: itemConfig.maxDurability,
                });
            }
            catch (error) {
                Utils.warning(error);
            }
        }
    }

    removeItem(slotIndex, skipSave) {
        // Remove it from the bank and squash the hole it left behind.
        // The items list shouldn't be holey.
        this.items.splice(slotIndex, 1);

        // Tell the player the item was removed from their bank.
        this.owner.socket.sendEvent(EventsList.remove_bank_item, slotIndex);

        // If this player has an account, update their account document that the item has been removed.
        if (!skipSave && this.owner.socket.account) {
            this.owner.socket.account.bankItems.splice(slotIndex, 1);
        }
    }

    modItemQuantity(bankItem, quantity, slotIndex, skipSave) {
        bankItem.modQuantity(quantity);

        if (bankItem.quantity > 0) {
            // Tell the player the new quantity of the modified stack.
            this.owner.socket.sendEvent(
                EventsList.modify_bank_item,
                {
                    slotIndex,
                    quantity: bankItem.quantity,
                    totalWeight: bankItem.totalWeight,
                },
            );

            // If this player has an account, save the new quantity.
            if (!skipSave && this.owner.socket.account) {
                this.owner.socket.account.bankItems[slotIndex].quantity = bankItem.quantity;
            }
        }
        // The stack is now empty, remove it.
        else {
            this.removeItem(slotIndex, skipSave);
        }
    }

    modMaxWeight(amount) {
        this.maxWeight += amount;

        // The setting might be decimal.
        this.maxWeight = Math.floor(this.maxWeight);

        // Tell the player their new max bank weight.
        this.owner.socket.sendEvent(EventsList.bank_max_weight, this.maxWeight);

        this.updateMaxWeightUpgradeCost();
    }

    updateMaxWeightUpgradeCost() {
        this.maxWeightUpgradeCost = Math.floor(
            this.maxWeight * (settings.MAX_BANK_WEIGHT_UPGRADE_COST_MULTIPLIER || 0),
        );
    }

    buyMaxWeightUpgrade() {
        // Check the player has enough glory.
        if (this.owner.glory < this.maxWeightUpgradeCost) return;

        this.owner.modGlory(-this.maxWeightUpgradeCost);

        this.modMaxWeight(settings.ADDITIONAL_MAX_BANK_WEIGHT_PER_UPGRADE);

        // Tell the player the next upgrade cost.
        this.owner.socket.sendEvent(
            EventsList.bank_max_weight_upgrade_cost,
            this.maxWeightUpgradeCost,
        );

        // If this player has an account, save the new bank upgrade level.
        if (this.owner.socket.account) {
            try {
                this.owner.socket.account.bankUpgrades += 1;
            }
            catch (error) {
                Utils.warning(error);
            }
        }
    }

    /**
     * Returns all of the items in this bank, in a form that is ready to be emitted.
     * @returns {Object}
     */
    getEmittableProperties() {
        const emittableInventory = {
            weight: this.weight,
            maxWeight: this.maxWeight,
            maxWeightUpgradeCost: this.maxWeightUpgradeCost,
            additionalMaxBankWeightPerUpgrade: settings.ADDITIONAL_MAX_BANK_WEIGHT_PER_UPGRADE,
            items: this.items.map((item, index) => ({
                id: item.id,
                slotIndex: index,
                typeCode: item.ItemType.prototype.typeCode,
                quantity: item.quantity,
                durability: item.durability,
                maxDurability: item.maxDurability,
                totalWeight: item.totalWeight,
            })),
        };

        return emittableInventory;
    }

    updateWeight() {
        const originalWeight = this.weight;
        this.weight = 0;

        this.items.forEach((item) => {
            this.weight += item.totalWeight;
        });

        // Only send if it has changed.
        if (this.weight !== originalWeight) {
            // Tell the player their new bank weight.
            this.owner.socket.sendEvent(EventsList.bank_weight, this.weight);
        }
    }

    findNonFullItemTypeStack(ItemType) {
        let slotIndex = null;
        const nonFullStack = this.items.find((item, index) => {
            if ((item.ItemType === ItemType)
            // Also check if the stack is not already full.
            && (item.quantity < item.MAX_QUANTITY)) {
                slotIndex = index;
                return true;
            }
            return false;
        });

        return {
            nonFullStack,
            slotIndex,
        };
    }

    addStackable(itemConfig, skipSave) {
        // Find if a stack for this type of item already exists.
        let { nonFullStack, slotIndex } = this.findNonFullItemTypeStack(itemConfig.ItemType);

        while (nonFullStack) {
            // Check there is enough space left in the stack to add these additional ones.
            if ((nonFullStack.quantity + itemConfig.quantity) > nonFullStack.MAX_QUANTITY) {
                // Not enough space. Add what can be added and keep the rest where it is, to then
                // see if another stack of the same type exists that it can be added to instead.

                const availableQuantity = (
                    nonFullStack.MAX_QUANTITY - nonFullStack.quantity
                );

                // Add to the found stack.
                this.modItemQuantity(nonFullStack, +availableQuantity, slotIndex, skipSave);

                // Some of the quantity to add has now been added to an existing stack, so reduce the amount
                // that will go into any other stacks, or into the new overflow stack if no other stack exists.
                itemConfig.modQuantity(-availableQuantity);

                // Check if there are any other non full stacks that the remainder can be added to.
                ({ nonFullStack, slotIndex } = this.findNonFullItemTypeStack(itemConfig.ItemType));
            }
            else {
                // Enough space. Add them all.
                this.modItemQuantity(nonFullStack, +itemConfig.quantity, slotIndex, skipSave);

                // Reduce the size of the incoming stack.
                itemConfig.modQuantity(-itemConfig.quantity);

                this.updateWeight();

                // Nothing left to move.
                return;
            }
        }

        // If there is anything left to add after all of the existing stacks have been filled, then
        // make some new stacks.
        // This should only need to add one stack, but catces any weird cases where they somehow
        // try to add a stack larger than the max stack size by splitting it up into smaller stacks.
        let remainingQuantity = itemConfig.quantity;
        while (remainingQuantity > 0) {
            let stackQuantity = itemConfig.quantity;
            // Add the stack being added to the bank as it is.
            let newStack = itemConfig;

            if (itemConfig.quantity > itemConfig.MAX_QUANTITY) {
                stackQuantity = itemConfig.MAX_QUANTITY;

                // Too much in the current stack, so split it into a new stack instead.
                newStack = new ItemConfig({
                    ItemType: itemConfig.ItemType,
                    quantity: stackQuantity,
                });

                itemConfig.modQuantity(-stackQuantity);
            }

            this.pushItem(newStack, true, skipSave);

            remainingQuantity -= stackQuantity;
        }
    }

    quantityThatCanBeAdded(config) {
        // Check there is enough weight capacity for any of the incoming stack to be added.
        // Might not be able to fit all of it, but still add what can fit.
        const incomingUnitWeight = config.ItemType.prototype.unitWeight;

        // Skip the weight calculation if the item is weightless.
        // Allow adding the entire quantity.
        if (incomingUnitWeight <= 0) {
            return config.quantity;
        }

        const freeWeight = this.maxWeight - this.weight;
        const quantityThatCanFit = Math.floor(freeWeight / incomingUnitWeight);

        // Don't return more than is in the incoming stack.
        // More might be able to fit, but the stack doesn't
        // need all of the available weight.
        if (quantityThatCanFit >= config.quantity) {
            return config.quantity;
        }

        return quantityThatCanFit;
    }

    /**
     *
     * @param {ItemConfig} config
     */
    canItemBeAdded(config) {
        if (!config) return false;

        const { ItemType } = config;

        if (!ItemType) return false;

        if (config.quantity) {
            if (this.quantityThatCanBeAdded(config) > 0) return true;
            return false;
        }
        if (config.durability) {
            if ((this.weight + ItemType.prototype.unitWeight) > this.maxWeight) return false;
            return true;
        }

        // Not a stackable or unstackable somehow. Prevent adding.
        return false;
    }

    /**
     * @param {Number} inventorySlotIndex
     * @param {Number} quantityToDeposit - Stackables only. How much of the stack to deposit.
     */
    depositItem(inventorySlotIndex, quantityToDeposit) {
        /** @type {Item} The inventory item to deposit. */
        const inventoryItem = this.owner.inventory.items[inventorySlotIndex];
        if (!inventoryItem) return;

        const depositItemConfig = new ItemConfig({
            ItemType: inventoryItem.itemConfig.ItemType,
            quantity: quantityToDeposit, // Need to check the actual amount to deposit, as they might not want to add all of it.
            durability: inventoryItem.itemConfig.durability,
            maxDurability: inventoryItem.itemConfig.maxDurability,
        });

        // Check they are next to a bank terminal.
        if (!this.owner.isAdjacentToStaticType(BankChest.prototype.typeNumber)) return;

        // Check there is enough space to store all of the desired amount to deposit.
        // Allow depositting weightless items no matter what.
        // Should be done on the client, but double-check here too.
        if ((depositItemConfig.totalWeight > 0)
        && ((this.weight + depositItemConfig.totalWeight) > this.maxWeight)) return;

        // Add if stackable.
        if (inventoryItem.itemConfig.ItemType.prototype.baseQuantity) {
            // When depositing a stackable, a quantity must be provided.
            if (!quantityToDeposit) return;

            // Check the quantity to deposit is not more than the amount in the stack.
            if (quantityToDeposit > inventoryItem.itemConfig.quantity) return;

            this.addStackable(depositItemConfig);

            // All of the stack should have been added, so now remove it from the inventory.
            this.owner.inventory.removeQuantityFromSlot(
                inventorySlotIndex,
                quantityToDeposit,
            );
        }
        // Add unstackable.
        else {
            // When depositing an unstackable, a quantity must not be provided.
            if (quantityToDeposit) return;

            this.pushItem(depositItemConfig, true);

            // Remove it from the inventory.
            this.owner.inventory.removeItemBySlotIndex(inventorySlotIndex);
        }

        this.updateWeight();
    }

    depositAllItems() {
        const { inventory } = this.owner;

        // Loop backwards to avoid dealing with shifting array indexes.
        for (let i = inventory.items.length - 1; i >= 0; i -= 1) {
            const item = inventory.items[i];
            // Check there is enough space to fit this item.
            if (!this.canItemBeAdded(item.itemConfig)) continue; // eslint-disable-line no-continue

            if (item.itemConfig.quantity) {
                this.depositItem(item.slotIndex, this.quantityThatCanBeAdded(item.itemConfig));
            }
            else {
                this.depositItem(item.slotIndex);
            }
        }
    }

    /**
     * @param {Number} bankSlotIndex
     * @param {Number} quantityToWithdraw - Stackables only. How much of the stack to withdraw.
     */
    withdrawItem(bankSlotIndex, quantityToWithdraw) {
        /** @type {ItemConfig} The bank item to withdraw. */
        const bankItem = this.items[bankSlotIndex];
        if (!bankItem) return;

        const withdrawItemConfig = new ItemConfig({
            ItemType: bankItem.ItemType,
            quantity: quantityToWithdraw, // Need to check the actual amount to withdraw, as they might not want to take all of it.
            durability: bankItem.durability,
            maxDurability: bankItem.maxDurability,
        });

        // Check they are next to a bank terminal.
        if (!this.owner.isAdjacentToStaticType(BankChest.prototype.typeNumber)) return;

        const { inventory } = this.owner;

        // Check there is enough inventory space to carry all of the desired amount to withdraw.
        // Allow withdrawing weightless items no matter what.
        // Should be done on the client, but double-check here too.
        if ((withdrawItemConfig.totalWeight > 0)
        && ((inventory.weight + withdrawItemConfig.totalWeight) > inventory.maxWeight)) return;

        // Remove if stackable.
        if (bankItem.ItemType.prototype.baseQuantity) {
            // When withdrawing a stackable, a quantity must be provided.
            if (!quantityToWithdraw) return;

            // Check the quantity to withdraw is not more than the amount in the stack.
            if (quantityToWithdraw > bankItem.quantity) return;

            // Store the item in the inventory.
            inventory.addItem(withdrawItemConfig);

            // All of the stack should have been added, so now remove it from the bank.
            this.removeQuantityFromSlot(
                bankSlotIndex,
                quantityToWithdraw,
            );
        }
        // Remove unstackable.
        else {
            // When withdrawing an unstackable, a quantity must not be provided.
            if (quantityToWithdraw) return;

            // Store the item in the inventory.
            inventory.addItem(withdrawItemConfig);

            this.removeItem(bankSlotIndex);
        }

        this.updateWeight();
    }

    removeItemBySlotIndex(slotIndex) {
        if (!this.items[slotIndex]) return;

        this.removeItem(slotIndex);
    }

    addStarterItems() {
        starterBankItemConfigsList.forEach((starterItemConfig) => {
            // Need to make new item config instances based on the existing ones, instead of just
            // using those ones, so they don't get mutated as they need to be the same every time.
            const itemConfig = new ItemConfig(starterItemConfig);

            // Store the item config in the bank.
            this.pushItem(itemConfig, false, true);
        });

        this.updateWeight();
    }

    removeQuantityFromSlot(slotIndex, quantity) {
        const item = this.items[slotIndex];
        if (!item) return;

        // Check it is actually a stackable.
        if (!item.quantity) return;

        // The quantity to remove cannot be higher than the quantity in the stack.
        if (quantity > item.quantity) {
            quantity = item.quantity;
            Utils.warning("Quantity to remove should not be greater than the quantity in the slot.");
        }

        // Reduce the quantity.
        this.modItemQuantity(item, -quantity, slotIndex);

        this.updateWeight();
    }
}

module.exports = Bank;
