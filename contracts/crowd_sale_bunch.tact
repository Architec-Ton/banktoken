import "@stdlib/deploy";
import "@stdlib/ownable";


message ReferralAddress {
        referral: Address;
    }

contract crowd_sale_bunch with Deployable,OwnableTransferable {

    unlockDate: Int as uint32;
    bankersAccounts: map<Address, Int>;
    referralsVals:  map<Address, Int>;
    totalBanks: Int as uint32;
    owner: Address;
    const MinTonForStorage: Int = ton("0.01"); // enough for 1 KB of storage for 2.5 years


    init(unlockDate: Int, owner: Address) {
        // self.val = 0;
        self.unlockDate = unlockDate;
        self.owner = owner;
        self.totalBanks = 0;    
    }

    // receive empty messages, these are usually simple TON coin transfers to the contract
    receive() {
        dump("empty message received");
        // revert the transaction if balance is growing over 3 TON
        require(myBalance() <= ton("3"), "Balance getting too high");
    }

    receive("buyBank") {

        self.sellBank (context().sender, context().value);
        send(SendParameters{
            to: self.owner,
            bounce: true,
            value: myBalance() - context().value - self.MinTonForStorage,
            mode: SendRemainingValue + SendIgnoreErrors
        });
    }

    receive (ref: ReferralAddress) {
        self.sellBank (context().sender, context().value);
        if  self.bankersAccounts.get(context().sender)!! > 0 {
            self.sellBank (ref.referral, context().value);
        }
        send(SendParameters{
            to: self.owner,
            bounce: true,
            value: myBalance() - context().value - self.MinTonForStorage,
            mode: SendRemainingValue + SendIgnoreErrors
        });
    }
    get fun myBanksBalance(): Int {
        return   self.bankersAccounts.get(context().sender)!!; 
    }

     fun sellBank (buyer: Address, amountTon: Int) {
        
        let accAmount:Int  = self.bankersAccounts.get(buyer)!!;
        let banks:Int = 0;
        if self.totalBanks <= 50_000 {
            banks =  amountTon / 1_000_000_000;
        }
        else if self.totalBanks > 50_000 && self.totalBanks <= 500_000 {
            banks =  amountTon / 1_500_000_000;
        }
        else if self.totalBanks > 500_000 && self.totalBanks <= 1_000_000 {
            banks =  amountTon / 2_000_000_000;
        }
        self.bankersAccounts.set(buyer, accAmount + banks );
        self.totalBanks += banks;
    }
}
