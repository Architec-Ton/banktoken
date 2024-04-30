import "@stdlib/deploy";
import "@stdlib/ownable";


message ReferralAddress {
        referral: Address;
    }

contract CrowdSale with  Deployable,OwnableTransferable {

    unlockDate: Int as uint32;
    bankersAccounts: map<Address, Int>;
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

        self.sellBank (context().sender, context().value);
        send(SendParameters{
            to: self.owner,
            bounce: true,
            value: context().value - self.MinTonForStorage,
            mode: /* SendRemainingValue + */ SendIgnoreErrors
        });
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
}

