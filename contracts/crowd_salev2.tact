import "@stdlib/deploy";
import "@stdlib/ownable";


message ReferralAddress {
        referral: Address;
    }

struct BankDetail{
    banks: Int as uint32;  //Count BANKS
    updateDate: Int as uint32; //Date last payment
    banksOfSec: Int; // Banks store in seconds on last payment
}

contract CrowdSalev2 with  Deployable,OwnableTransferable {

    unlockDate: Int as uint32;
    bankersAccounts: map<Address, BankDetail>;
    //referralsVals:  map<Address, Int>;
    totalBanks: Int;
    owner: Address;
    const MinTonForStorage: Int = ton("0.5"); // enough for 50 B of storage for 2.5 years


    init(unlockDate: Int) {
        // self.val = 0;
        self.unlockDate = unlockDate;
        self.owner = context().sender;
        self.totalBanks = 0;    
    }

    // receive empty messages, these are usually simple TON coin transfers to the contract
    receive() {

        // Any can buy banks directly instead owner (owner can buy from buyBank)
        if (sender() != self.owner){
            self.payBank(context().sender, context().value);
        }
        // Owner can charge contract balance
    }

    receive("buyBank") {
        self.payBank(context().sender, context().value);
    }

    receive(ref: ReferralAddress) {
        // Check if the sender has already bought banks; fail if not
        //let referrerBanks: Int as uint32? = self.bankersAccounts.get(ref.referral);
        //require(referrerDetails.banks > 0, "Referral doesn't have any banks");
        //let senderBanks: Int as uint32? = self.bankersAccounts.get(context().sender);
        let BanksToBuy: Int = self.payBank(context().sender, context().value);
        self.sellBank (ref.referral, BanksToBuy, now());
        // Check if the referrer already has a record in the bankersAccounts
        
        // If the referrer is getting a referral for the first time (i.e., purchaseDate is 0), award extra banks
        // if (referrerDetails.purchaseDate == 0 && referrerDetails.banks == 0) {
        //     let extraBanks: Int = banksToBuy / 10; // For example, give 10% of the bought banks as a bonus
        //     self.sellBank(ref.referral, extraBanks);
        // }
    }


    get fun Banker(addr: Address): BankDetail? {
        return  self.bankersAccounts.get(addr); 
    }

    get fun Banks(addr: Address): Int {
        let check: BankDetail? = self.bankersAccounts.get(addr);
        if (check == null){
            return 0;
        }else{
            let detail: BankDetail = check!!;
            return detail.banks;
        }
    }


    get fun Coins(addr: Address): Int {
        let check: BankDetail? = self.bankersAccounts.get(addr);
        if (check == null){
            return 0;
        }else{
            let detail: BankDetail = check!!;
            return detail.banksOfSec + ((now() - detail.updateDate) * detail.banks);
        }
    }

    get fun Accounts(): map<Address, BankDetail> {
        // require(sender() == self.owner, "Access denied");
        return   self.bankersAccounts; 
    }

    
    fun payBank(buyer: Address, tons: Int): Int {
        let bankCost: Int = ton("0.01"); //Bank cost in nanoTon

        if (self.totalBanks > 50_000) {bankCost = ton("0.015");}
        if (self.totalBanks > 500_000) {bankCost = ton("0.02");}
        if (self.totalBanks > 1_000_000) {bankCost = ton("0.03");}


        let amountTon: Int = tons;
        let banksToBuy: Int = amountTon / bankCost; // Calculate how many banks can be bought with the received TONs
        let usedTon: Int = banksToBuy * bankCost; // Calculate how much TON was actually used to buy banks
        let refundTon: Int = amountTon - usedTon; // Calculate the leftover TON to refund
        self.sellBank(buyer, banksToBuy, now()); // Use the modified sellBank function to update banks
        if (refundTon > 0) {
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


    fun sellBank(buyer: Address, bankCount: Int, currentDate: Int) {
        let checkBanks: BankDetail? = self.bankersAccounts.get(buyer);
        let currentDetails: BankDetail = ((checkBanks == null))? BankDetail{
                                                                    banks: 0,
                                                                    updateDate: currentDate,
                                                                    banksOfSec: 0
                                                                }: checkBanks!!;
        // Update record
        self.bankersAccounts.set(buyer, BankDetail{
            banks: bankCount + currentDetails.banks,
            updateDate: currentDate,
            // banks in seconds (how log account have banks)
            banksOfSec: currentDetails.banksOfSec + ((currentDate - currentDetails.updateDate) * currentDetails.banks)


        });
        // Increase banks
        self.totalBanks += bankCount;
        
        // Push notification (we can catch in future)
        emit( beginCell()
                .storeAddress(buyer)
                .storeUint(bankCount + currentDetails.banks, 32)
                .endCell()
         );
    }

}

