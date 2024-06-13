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
    parameter: Int as uint16;
    firstCell:Address;
    lastCell:Address;

    // TODO: 
    // jetton_root_init: InitOf;
    // get fun get_jetton_root(): Address{}
    // InitOf vs Address: Which one has lowest storage cost? 

    init(_jettonAddress: Address, _parameter: Int){
        self.jettonAddress = _jettonAddress;
        self.parameter = _parameter;
        self.owner = context().sender;
        self.start_time = now();
        self.firstCell = newAddress(0,0);
        self.lastCell = newAddress(0,0);
    }

    // The notification for the Jetton Token contract noification(when current address receive the token will get the notification)
    receive(stake: JettonTransferNotification){
        dump("JettonTransferNotification");
        require(context().value >= ton("0.1"), "not enough value");
        let stakeInit: StateInit = initOf StakeStorage(self.owner, self.jettonAddress);
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
        //update iterator

        send(SendParameters{
                to: self.lastCell, 
                value: 0,
                mode: SendRemainingValue, 
                bounce: false,
                body:UpdateNext {
                    nextCell: contractAddress(stakeInit) // Address;
                }.toCell()
        });
        self.lastCell = contractAddress(stakeInit);

        // Check the sender is from the Jetton Wallet
        // require(context().sender == self.jettonAddress, "not from one of any jetton wallet");
        
        // Manipulating the score you want to give, no matter based on time or amount
        /* let score: Int = self.score_function(stake.amount);
        
        // Update the stake record
        self.stake_record.set(self.index,
            StakeRecord{
                stake_address: stake.from, 
                jettonStakeAmount: stake.amount, 
                score: score
            }
        );

        // Update the weight of the user, if the user is in the list, then add it
        let previous_score: Int = self.score_list.get(stake.from)!!;
        if (previous_score == null) {
            self.score_list.set(stake.from, score);
        } else if (previous_score >= 0) {
            previous_score = (previous_score + score);
            self.score_list.set(stake.from, previous_score);
        }
        self.total_score = (self.total_score + score);
        self.index = (self.index + 1);
*/
        // Submit the Log Event 
        // emit(TransferEvent{sender_address: stake.from, jetton_amount: stake.amount, score: score}.toCell());
    }

    // To get the ratio of a user in a on-chain ways
    // receive(msg: GetWeighted){
    //     let ctx: Context = context();
    //     let user_score: Int = self.score_list.get(msg.applied_user_address)!!;
    //     require(user_score > 0, "no Record");
    //     send(SendParameters{
    //             to: ctx.sender,
    //             value: 0,
    //             mode: (SendRemainingValue + SendIgnoreErrors),
    //             bounce: true,
    //             body: PassScoreToRoundContract{
    //                 checked_address: msg.applied_user_address, // 0xe5fd7f29
    //                 return_score: user_score
    //             }.toCell()
    //         }
    //     );
    // }

    // receive(msg: AdminExecute) {}

    receive(msg: Unstake){
        let weight: Int = self.score_list.get(context().sender)!!;
        require(weight > 0, "not in the list"); // TODO: only checking point

        // Send Transfer to self.get_major_jetton_address(myAddress())
        // Transfer the jetton token back: Amount, who
        let stake_record: StakeRecord = self.stake_record.get(msg.index_id)!!;
        require(stake_record.jettonStakeAmount > 0, "don't have value");
        self.stake_record.set(msg.index_id, null);
        send(SendParameters{
                to: self.jettonAddress,
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

    get fun calculate_stake_address(_owner: Address, _factory: Address): Address {
        
        return contractAddress(initOf StakeStorage(_owner, _factory));
    }
    get fun get_user_stake_record(): map<Int, StakeRecord> {
        return self.stake_record;
    }

    get fun get_user_stake_amount(): map<Address, Int> {
        return self.score_list;
    }

    // get fun get_return_staking_data(): StakingData {
    //     return
    //         StakingData{
    //             index: self.index,
    //             jettonAddress: self.jettonAddress!!,
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
}


