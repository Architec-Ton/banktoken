import "@stdlib/deploy";
import "@stdlib/ownable";

message ReferralAddress {
    referral: Address;
}

message ChangePrice1stage{
    price:Int;
}

message ChangePrice2stage{
    price:Int;
}

message ChangePrice3stage{
    price:Int;
}

message Bonus {
    to: Address;
    amount: Int as uint32;
}

message SetManager {
    to: Address;
}

message SetBankOffset {
    offset: Int as uint32;
}

contract BanksCrowdSaleV2 with Deployable, OwnableTransferable {

    bankersAccounts: map<Address, Int as uint32>;
    totalBanks: Int as uint32;
    totalBankers: Int as uint32;
    saleEnabled: Bool;
    owner: Address;
    manager: Address;
    price1stage: Int as uint32;
    price2stage: Int as uint32;
    price3stage: Int as uint32;
    totalBanksOffset: Int as uint32;

    const MinTonForStorage: Int = ton("0.5"); // enough for 50 B of storage for 2.5 years

    init() {
        self.saleEnabled = true;
        self.totalBanks = 0;
        self.totalBankers = 0;
        self.totalBanksOffset = 0;
        self.owner = context().sender;
        self.manager = context().sender;
        self.price1stage = ton("1");
        self.price2stage = ton("1.5");
        self.price3stage = ton("2");
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

    get fun TotalBankers(): Int {
        return self.totalBankers;
    }

        // receive empty messages, these are usually simple TON coin transfers to the contract
    receive() {

        // Any can buy banks directly instead owner (owner can buy from buyBank)
        if (sender() != self.owner){
            self.payBank(sender(), context().value);
        }
        // Owner can charge contract balance
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
        let referrerBanks: Int? = self.bankersAccounts.get(ref.referral);
        require(referrerBanks != null , "Referral doesn't have any banks"); //&& referrerBanks!! > 0

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

    receive(newPrice: ChangePrice1stage ) {
        require(sender() == self.owner, "Access denied");
         self.price1stage = newPrice.price;
    }

    receive(newPrice: ChangePrice2stage ) {
        require(sender() == self.owner, "Access denied");
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
    }

    fun payBank(buyer: Address, tons: Int): Int {
        require(self.saleEnabled, "Sale stopped");
        require(self.totalBanks <= 1_000_000, "Sale ended");

        let bankPrice: Int = self.price1stage; //Bank cost in nanoTon
        if (self.totalBanks + self.totalBanksOffset > 50_000) {bankPrice = self.price2stage;}
        if (self.totalBanks + self.totalBanksOffset > 500_000) {bankPrice = self.price3stage;}
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


        // We send ton if balance more then 0.6 ton
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
