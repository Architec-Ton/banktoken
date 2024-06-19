import "@stdlib/deploy";
import "./bank_jetton.tact";
import "./imports/message.tact";
import "./stake_storage.tact";

contract BankStaking with Deployable {
    jettonAddress: Address;
    owner: Address;
    index: Int as uint32 = 0;
    stake_record: map<Int, StakeRecord>;
    score_list: map<Address, Int>;
    start_time: Int as uint32;
    total_score: Int as uint128 = 0;
    firstCell:Address;
    lastCell:Address;

    // TODO: 
    // jetton_root_init: InitOf;
    // get fun get_jetton_root(): Address{}
    // InitOf vs Address: Which one has lowest storage cost? 

    init( _owner:Address, _BNKjetton: Address){ //, _ARCjetton: Address
        self.BNKjetton = _BNKjetton;
        // self.ARCjetton = _ARCjetton;
        self.owner = _owner;//context().sender;
        self.start_time = now();
        self.firstCell = newAddress(0,0);
        self.lastCell = newAddress(0,0);
    }

    // The notification for the Jetton Token contract noification(when current address receive the token will get the notification)
    receive(stake: JettonTransferNotification){
        dump("JettonTransferNotification");
        require(context().value >= ton("0.1"), "not enough value");
        let stakeInit: StateInit = initOf StakeStorage(self.owner, self.BNKjetton);
        // init iterator if need
        if (self.firstCell ==  newAddress(0, 0)) {self.firstCell = contractAddress(stakeInit);}
        if (self.lastCell ==  newAddress(0, 0)) {self.lastCell = contractAddress(stakeInit);}
        //send stake info
        send(SendParameters{
                to: contractAddress(stakeInit), 
                value: 0,
                mode: SendRemainingValue, 
                bounce: true,
                body:Add {
                        queryId: stake.query_id, //Int as uint64;
                        amount:  stake.amount, //Int as uint32;
                        previousCell: self.lastCell, // Address;
                        nextCell: self.firstCell // Address;
                }.toCell(),
                code: stakeInit.code,
                data: stakeInit.data
        });
        
        send(SendParameters{
                to: self.lastCell, 
                value: 1,
                mode: SendRemainingValue  + SendIgnoreErrors,
                bounce: false,
                body:UpdateNext {
                    nextCell: contractAddress(stakeInit) // Address;
                }.toCell()
        });
        self.lastCell = contractAddress(stakeInit);
        // TODO 
        // Check the sender is from the Jetton Wallet
        // require(context().sender == self.BNKjetton, "not from one of any jetton wallet");
        // TODO 
        // Submit the Log Event 
        // emit(TransferEvent{sender_address: stake.from, jetton_amount: stake.amount, score: score}.toCell());
    }


    receive(msg: Unstake){
        let weight: Int = self.score_list.get(context().sender)!!;
        require(weight > 0, "not in the list"); // TODO: only checking point

        // Send Transfer to self.get_major_jetton_address(myAddress())
        // Transfer the jetton token back: Amount, who
        let stake_record: StakeRecord = self.stake_record.get(msg.index_id)!!;
        require(stake_record.jettonStakeAmount > 0, "don't have value");
        self.stake_record.set(msg.index_id, null);
        send(SendParameters{
                to: self.BNKjetton,
                value: 0,
                mode: (SendRemainingValue + SendIgnoreErrors),
                bounce: false, // 0x7362d09c - notify new owner
                body: JettonTransfer{
                    query_id: 0,
                    amount: stake_record.jettonStakeAmount,
                    destination: context().sender,
                    response_destination: myAddress(),
                    custom_payload: null,
                    forward_ton_amount: ton("0.01"),
                    forward_payload: emptySlice()
                }.toCell()
            }
        );
    }



    // TODO: Admin 強制 UnStake所有代幣？
    // admin enable to withdraw the token to the original depositor

    receive(){}

    // get fun get_user_stake_record(): map<Int, StakeRecord> {
    //     return self.stake_record;
    // }

    // get fun get_user_stake_amount(): map<Address, Int> {
    //     return self.score_list;
    // }

    // get fun get_return_staking_data(): StakingData {
    //     return
    //         StakingData{
    //             index: self.index,
    //             BNKjetton: self.BNKjetton!!,
    //             total_score: self.total_score,
    //             parameter: self.parameter
    //         };
    // }

     // get fun get_ratio_of_stake(StakeTokenAmount: Int): Int {
    //     return self.score_function(StakeTokenAmount) * pow(10, 9) / self.total_score;
    // }
    // get fun get_ratio_of_stake_2(StakeTokenAmount: Int): Int {
    //     return self.score_function(StakeTokenAmount) * pow(10, 6) / self.total_score;
    // }
    // get fun get_ratio_of_stake_3(StakeTokenAmount: Int): Int {
    //     return self.score_function(StakeTokenAmount) * 100 / self.total_score / 100;
    // }

    get fun calculate_stake_address(_owner: Address, _factory: Address): Address {
        
        return contractAddress(initOf StakeStorage(_owner, _factory));
    }
    
}


        

