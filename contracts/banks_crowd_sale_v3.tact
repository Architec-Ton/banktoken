import "@stdlib/deploy";
import "@stdlib/ownable";
import "./jetton/JettonWallet";

message ReferralAddress {
    referral: Address;
}

message ChangePrice1stage {
    price:Int;
}

message ChangePrice2stage {
    price:Int;
}

message ChangePrice3stage {
    price:Int;
}

message Bonus {
    to: Address;
    amount: Int as uint32;
}

message BonusOk {
    to: Address;
    amount: Int as uint32;
}

message SetManager {
    to: Address;
}

message SetBankOffset {
    offset: Int as uint32;
}

message SetBankersOffset {
    offset: Int as uint32;
}

message SetJettonWallet {
    jetton_wallet: Address;
}

message SetNewOwner {
    new_owner: Address;
}

contract BanksCrowdSaleV3 with Deployable, OwnableTransferable {
    totalBanks: Int as uint32;
    totalBankers: Int as uint32;
    saleEnabled: Bool;
    owner: Address;
    manager: Address;
    price1stage: Int as uint32;
    price2stage: Int as uint32;
    price3stage: Int as uint32;
    price4stage: Int as uint32;
    totalBanksOffset: Int as uint32;
    totalBankersOffset: Int as uint32;

    jetton_wallet: Address;

    const MinTonForStorage: Int = ton("0.5"); // enough for 50 B of storage for 2.5 years
    const jetton_transfer_fee: Int = ton("0.4"); // ~ 0.4 TON, medium fee for any amount of Jetton is 0.037 TON - docs
    // but we deploy buyer's JettonWallet, so gas is big ~ 0.2 - 0.3

    init() {
        self.saleEnabled = true;
        self.totalBanks = 0;
        self.totalBankers = 0;
        self.totalBanksOffset = 107613;
        self.totalBankersOffset = 4209;
        self.owner = context().sender;
        self.manager = context().sender;
        self.price1stage = ton("1");
        self.price2stage = ton("1.5");
        self.price3stage = ton("2");
        self.price4stage = ton("4");

        self.jetton_wallet = myAddress();
    }

    get fun TotalBanks(): Int {
        return self.totalBanks + self.totalBanksOffset;
    }

    get fun Manager(): Address{
        return self.manager;
    }

    get fun TotalBankers(): Int {
        return self.totalBankers + self.totalBankersOffset;
    }

    // receive empty messages, these are usually simple TON coin transfers to the contract
    receive() {
        // Any can buy banks directly instead owner (owner can buy from buyBank)
        if (sender() != self.owner){
            self.payBank(sender(), context().value, false);
        }
        // Owner can charge contract balance
    }

    receive(msg: SetJettonWallet) {
        require(sender() == self.owner, "Access denied");
        self.jetton_wallet = msg.jetton_wallet;
    }

    receive("buyBank") {
        self.payBank(sender(), context().value, false);
    }

    receive("stopSale") {
        require(sender() == self.owner, "Access denied");
        self.saleEnabled = false;
    }

    receive("resumeSale") {
        require(sender() == self.owner, "Access denied");
        self.saleEnabled = true;
    }

    receive(ref: ReferralAddress) {
        // Check if the sender has already bought banks; fail if not
        require(sender() != ref.referral, "Referral wrong");

        self.payBank(ref.referral, context().value, false);
        self.payBank(sender(), context().value, false);
    }

    receive(manager: SetManager) {
        require(sender() == self.owner, "Access denied");
        self.manager = manager.to;
    }

    receive(bankOffset: SetBankOffset) {
        require(sender() == self.owner, "Access denied");
        self.totalBanksOffset = bankOffset.offset;
    }

    receive(bankerOffset: SetBankersOffset) {
        self.requireOwner();
        self.totalBankersOffset = bankerOffset.offset;
    }

    receive(newPrice: ChangePrice1stage) {
        self.requireOwner();
        self.price1stage = newPrice.price;
    }

    receive(newPrice: ChangePrice2stage) {
        self.requireOwner();
        self.price2stage = newPrice.price;
    }

    receive(newPrice: ChangePrice3stage) {
        require(sender() == self.owner, "Access denied");
        self.price3stage = newPrice.price;
    }
    receive(bonus: Bonus) {
        require(sender() == self.manager, "Access denied");
        self.payBank(bonus.to, bonus.amount, false);
    }
    receive(msg: SetNewOwner) {
        require(sender() == self.manager, "Access denied");
        self.owner = msg.new_owner;
    }

    fun payBank(buyer: Address, tons: Int, is_ref: Bool) {
        require(self.saleEnabled, "Sale stopped");
        require((self.totalBanks + self.totalBanksOffset) <= 2_800_000, "Sale ended");

        let bankPrice: Int = self.price1stage; //Bank cost in nanoTon
        if (self.totalBanks + self.totalBanksOffset > 50_000) {
            bankPrice = self.price2stage;
        }
        if (self.totalBanks + self.totalBanksOffset > 500_000) {
            bankPrice = self.price3stage;
        }
        if (self.totalBanks + self.totalBanksOffset > 1_000_000) {
            bankPrice = self.price4stage;
        }

        let amountTon : Int = tons;
        let banksToBuy: Int = amountTon / bankPrice ; // Calculate how many banks can be bought with the received TONs
        let usedTon: Int = banksToBuy * bankPrice; // Calculate how much TON was actually used to buy banks
        let refundTon: Int = amountTon - usedTon; // Calculate the leftover TON to refund
        self.totalBanks += banksToBuy;

        if (refundTon > ton("0.005") && !is_ref) {
                send(SendParameters{
                to: buyer,
                bounce: true,
                value: refundTon,
                mode: SendIgnoreErrors
            }); // Refund any unused TON
        }

        send(SendParameters{
                to: self.jetton_wallet,
                value: self.jetton_transfer_fee,
                bounce: true,
                mode: SendIgnoreErrors,
                body: JettonTransfer {
                    query_id: 0,
                    amount: banksToBuy * 1000000000,
                    destination: buyer,
                    response_destination: self.owner,
                    custom_payload: null,
                    forward_payload: emptySlice(),
                    forward_ton_amount: 0
            }.toCell()
        });

        //         We send ton if balance more then 0.6 ton
        if ((myBalance() - self.MinTonForStorage - self.jetton_transfer_fee) > ton("0.1") && !is_ref) {
            send(SendParameters{
            to: self.owner,
            bounce: true,
            value: myBalance() - self.MinTonForStorage - self.jetton_transfer_fee,
            mode: SendIgnoreErrors
            }); // Send all ton minus Min for storage
        }
    }
}
