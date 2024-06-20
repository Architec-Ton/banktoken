import "@stdlib/deploy";
import "@stdlib/ownable";
import "./jetton/JettonWallet.tact";

contract BankJettonWallet with JettonWallet {
    balance: Int as coins = 0;
    owner: Address;
    jetton_master: Address;

    init(owner: Address, jetton_master: Address) {
        self.owner = owner;
        self.jetton_master = jetton_master;
    }

    override inline fun calculate_jetton_wallet_init(owner_address: Address): StateInit {
        return initOf BankJettonWallet(owner_address, self.jetton_master);
    }
}

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

contract BanksCrowdSaleV3 with Deployable, OwnableTransferable {
    jetton_transfer_fee: Int = 400000000; // ~ 0.4 TON, medium fee for any amount of Jetton is 0.037 TON - docs
    // but we deploy buyer's JettonWallet, so gas is big ~ 0.2 - 0.3

    bankersAccounts: map<Address, Int as uint32>;
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

    jetton_master: Address;
    jetton_wallet: Address;

    const MinTonForStorage: Int = ton("0.5"); // enough for 50 B of storage for 2.5 years

    init(jetton_master: Address) {
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

        self.jetton_master = jetton_master;

        let init: StateInit = initOf BankJettonWallet(myAddress(), jetton_master);
        self.jetton_wallet = contractAddress(init);
    }

    get fun data(): Address {
        return self.jetton_wallet;
    }

    get fun Banks(addr: Address): Int {
        let banks: Int? = self.bankersAccounts.get(addr);
        if (banks == null){
            return 0;
        }else{
            return banks!!;
        }
    }
    get fun TotalBanks(): Int {
        return self.totalBanks + self.totalBanksOffset;
    }

    get fun Bankers(): map<Address, Int as uint32> {
        // require(sender() == self.owner, "Access denied");
        return self.bankersAccounts;
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
            self.payBank(sender(), context().value);
        }
        // Owner can charge contract balance
    }

    receive(msg: SetJettonWallet) {
        require(sender() == self.owner, "Access denied");
        self.jetton_wallet = msg.jetton_wallet;
    }

    receive("buyBank") {
        self.payBank(sender(), context().value);
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
        // let referrerBanks: Int? = self.bankersAccounts.get(ref.referral);
        // require(referrerBanks != null , "Referral doesn't have any banks"); //&& referrerBanks!! > 0

        let BanksToBuy: Int = self.payBank(sender(), context().value);
        self.sellBank (ref.referral, BanksToBuy);
    }

    receive(manager: SetManager ) {
        require(sender() == self.owner, "Access denied");
        self.manager = manager.to;
    }

    receive(bankOffset: SetBankOffset ) {
        require(sender() == self.owner, "Access denied");
        self.totalBanksOffset = bankOffset.offset;
    }

    receive(bankerOffset: SetBankersOffset ) {
        self.requireOwner();
        self.totalBankersOffset = bankerOffset.offset;
    }

    receive(newPrice: ChangePrice1stage ) {
        self.requireOwner();
        self.price1stage = newPrice.price;
    }

    receive(newPrice: ChangePrice2stage ) {
        self.requireOwner();
        self.price2stage = newPrice.price;
    }

    receive(newPrice: ChangePrice3stage ) {
        require(sender() == self.owner, "Access denied");
        self.price3stage = newPrice.price;
    }
    receive(bonus: Bonus ) {
        require(sender() == self.manager, "Access denied");
        self.sellBank(bonus.to, bonus.amount);
    }

    fun sellBank(buyer: Address, bankCount: Int) {
        require(bankCount > 0, "Bank's must be not zero");
        let banks: Int? = self.bankersAccounts.get(buyer);
        let currentBanks: Int = (banks == null)? 0: banks!!;
        // Update record
        self.bankersAccounts.set(buyer, currentBanks + bankCount);
        if (currentBanks == 0){
            self.totalBankers+=1;
        }
        self.totalBanks+=bankCount;

        // Push notification (we can catch in future)
        emit( beginCell()
        .storeAddress(buyer)
        .storeUint(currentBanks + bankCount, 32)
        .endCell()
        );
        //        self.reply(BonusOk{ to: buyer, amount: currentBanks + bankCount }.toCell());
    }

    fun payBank(buyer: Address, tons: Int): Int {
        require(self.saleEnabled, "Sale stopped");
        require( (self.totalBanks + self.totalBanksOffset) <= 2_800_000, "Sale ended");

        let bankPrice: Int = self.price1stage; //Bank cost in nanoTon
        if (self.totalBanks + self.totalBanksOffset > 50_000) {
            bankPrice = self.price2stage;}
        if (self.totalBanks + self.totalBanksOffset > 500_000) {
            bankPrice = self.price3stage;}
        if (self.totalBanks + self.totalBanksOffset > 1_000_000) {
            bankPrice = self.price4stage;}
        let amountTon : Int = tons;
        let banksToBuy: Int = amountTon / bankPrice; // Calculate how many banks can be bought with the received TONs
        let usedTon: Int = banksToBuy * bankPrice; // Calculate how much TON was actually used to buy banks
        let refundTon: Int = amountTon - usedTon; // Calculate the leftover TON to refund
        self.sellBank(buyer, banksToBuy); // Use the modified sellBank function to update banks
        if (refundTon > ton("0.005")) {
            send(SendParameters{
            to: buyer,
            bounce: true,
            value: refundTon,
            mode: SendIgnoreErrors
            }); // Refund any unused TON
        }


        let init: StateInit = initOf BankJettonWallet(myAddress(), self.jetton_master);
        let receiver: Address = contractAddress(init);
        send(SendParameters{
        to: self.jetton_wallet,
        value: self.jetton_transfer_fee,
        bounce: true,
        mode: SendIgnoreErrors,
        body: JettonTransfer {
        query_id: 0,
        amount: banksToBuy * 1000000000,
        destination: buyer,
        response_destination: buyer,
        custom_payload: null,
        forward_payload: emptySlice(),
        forward_ton_amount: 0
        }.toCell()
        });


        //         We send ton if balance more then 0.6 ton
        if ( (myBalance() - self.MinTonForStorage) > ton("0.1") ){
            send(SendParameters{
            to: self.owner,
            bounce: true,
            value: myBalance() - self.MinTonForStorage,
            mode: SendIgnoreErrors
            }); // Send all ton minus Min for storage
        }

        return banksToBuy;
    }
}
