import "@stdlib/deploy";
import "@stdlib/ownable";


message ReferralAddress {
        referral: Address;
    }

struct BankDetails {
    banks: Int;
    withdrawalDate: Int as uint32; // Unix timestamp of the purchase/withdrawal date
}

contract CrowdSalev2 with  Deployable,OwnableTransferable {

    unlockDate: Int as uint32;
    bankersAccounts: map<Address, BankDetails>;
    referralsVals:  map<Address, Int>;
    totalBanks: Int as uint32;
    owner: Address;
    const MinTonForStorage: Int = ton("0.0005"); // enough for 50 B of storage for 2.5 years


    init(unlockDate: Int) {
        // self.val = 0;
        self.unlockDate = unlockDate;
        self.owner = context().sender;
        self.totalBanks = 0;    
    }

    // receive empty messages, these are usually simple TON coin transfers to the contract
    receive() {
        // dump("empty message received");
        // revert the transaction if balance is growing over 3 TON
        // require(myBalance() <= ton("3"), "Balance getting too high");
        dump("received");
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
        let referrerDetails: BankDetails = self.bankersAccounts.get(ref.referral) ? self.bankersAccounts.get(ref.referral): BankDetails{banks: 0, withdrawalDate: 0};
        //require(referrerDetails.banks > 0, "Referral doesn't have any banks");
        let senderDetails: BankDetails = self.bankersAccounts.get(context().sender) ?self.bankersAccounts.get(context().sender) : BankDetails{banks: 0, withdrawalDate: 0};
        let BanksToBuy: Int = self.payBank(context().sender, context().value);
        self.sellBank (ref.referral, BanksToBuy);
        // Check if the referrer already has a record in the bankersAccounts
        
        // If the referrer is getting a referral for the first time (i.e., purchaseDate is 0), award extra banks
        // if (referrerDetails.purchaseDate == 0 && referrerDetails.banks == 0) {
        //     let extraBanks: Int = banksToBuy / 10; // For example, give 10% of the bought banks as a bonus
        //     self.sellBank(ref.referral, extraBanks);
        // }
    }

    receive (ref: ReferralAddress) {
        require( self.bankersAccounts.get(context().sender)!! > 0, "Referal don't has any  banks" );

        self.sellBank (context().sender, context().value);
        self.sellBank (ref.referral, context().value);
        
        send(SendParameters{
            to: self.owner,
            bounce: true,
            value:  context().value - self.MinTonForStorage,
            mode: /* SendRemainingValue + */ SendIgnoreErrors
        });
    }
    get fun myBanksBalance(): Int {
        return   self.bankersAccounts.get(context().sender)!!; 
    }

    get fun someoneBanksBalance(addr: Address): Int {
        return   self.bankersAccounts.get(addr)!!; 
    }

    
    fun payBank(buyer: Address, tons: Int): Int {
        let bankCost: Int = ton("0.02"); //Bank cost in nanoTon
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
        let currentDetails: BankDetails = self.bankersAccounts.get(buyer) ?self.bankersAccounts.get(buyer): BankDetails{banks: 0, withdrawalDate: 0};
        let newDetails: BankDetails = BankDetails{
            banks: currentDetails.banks + banks,
            withdrawalDate: currentDetails.withdrawalDate? currentDetails.withdrawalDate: now() // Assuming `now()` returns the current Unix timestamp
        };
        self.bankersAccounts.set(buyer, newDetails);
        self.totalBanks += banks;
        dump("Updated account for buyer:");
        dump(buyer);
        dump("Number of banks added:");
        dump(banks);
        dump("Purchase date:");
        dump(newDetails.withdrawalDate);
        dump("New total number of banks:");
        dump(self.totalBanks);
    }
/*
     fun sellBank (buyer: Address, amountTon: Int) {
        
        let accAmount:Int  = self.bankersAccounts.get(buyer)!!;
        dump("accAmount");
        dump(accAmount);
        let banks:Int = 0;
        if self.totalBanks <= 50_000 {
            dump("<50000");
            banks =  amountTon / 1_000_000; //for test net only. for mainnet set to 1_000_000_000;
            dump(banks);
        }
        else if self.totalBanks > 50_000 && self.totalBanks <= 500_000 {
            banks =  amountTon /  1_500_000; //for test net only. for mainnet set to 1_500_000_000;
        }
        else if self.totalBanks > 500_000 && self.totalBanks <= 1_000_000 {
            banks =  amountTon / 2_000_000_000;
        }
        self.bankersAccounts.set(buyer, accAmount + banks );
        self.totalBanks += banks;
        dump("totalBanks");
        dump(self.totalBanks);
    }
    */
}

