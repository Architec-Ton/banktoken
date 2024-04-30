import "@stdlib/deploy";
import "@stdlib/ownable";


message ReferralAddress {
        referral: Address;
    }

contract CrowdSalev2 with  Deployable,OwnableTransferable {

    unlockDate: Int as uint32;
    bankersAccounts: map<Address, Int>;
    //referralsVals:  map<Address, Int>;
    totalBanks: Int;
    owner: Address;
    const MinTonForStorage: Int = ton("0.01"); // enough for 50 B of storage for 2.5 years


    init(unlockDate: Int) {
        // self.val = 0;
        self.unlockDate = unlockDate;
        self.owner = context().sender;
        self.totalBanks = 0;    
    }

    // receive empty messages, these are usually simple TON coin transfers to the contract
    receive() {
        dump(context().value);
        self.sellBank (context().sender, context().value);
        send(SendParameters{
            to: self.owner,
            bounce: true,
            value: context().value - self.MinTonForStorage,
            mode: /* SendRemainingValue + */ SendIgnoreErrors
        });
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
        self.sellBank (ref.referral, BanksToBuy);
        // Check if the referrer already has a record in the bankersAccounts
        
        // If the referrer is getting a referral for the first time (i.e., purchaseDate is 0), award extra banks
        // if (referrerDetails.purchaseDate == 0 && referrerDetails.banks == 0) {
        //     let extraBanks: Int = banksToBuy / 10; // For example, give 10% of the bought banks as a bonus
        //     self.sellBank(ref.referral, extraBanks);
        // }
    }


    get fun myBanksBalance(): Int? {
        return   self.bankersAccounts.get(context().sender); 
    }

    get fun someoneBanksBalance(addr: Address): Int? {
        return   self.bankersAccounts.get(addr); 
    }

    get fun accountsBalance(): map<Address, Int> {
        require(sender() == self.owner, "Access denied");
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
        self.sellBank(buyer, banksToBuy); // Use the modified sellBank function to update banks
        if (refundTon > 0) {
            send(SendParameters{
                to: buyer,
                bounce: true,
                value: refundTon,
                mode: SendIgnoreErrors
            }); // Refund any unused TON
        }
        
        send(SendParameters{
            to: self.owner,
            bounce: true,
            value: usedTon - self.MinTonForStorage,
            mode: SendIgnoreErrors
        }); // Send the used TON minus the storage fee to the owner
        return banksToBuy;
    }


    fun sellBank(buyer: Address, banks: Int) {
        let currentDetails: Int? = self.bankersAccounts.get(buyer);
        if (currentDetails == null) {currentDetails = 0;}
        self.bankersAccounts.set(buyer, currentDetails!! + banks);
        self.totalBanks += banks;
    }

}

