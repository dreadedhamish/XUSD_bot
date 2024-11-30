// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;


import "./AccessControl/AccessorMod.sol";
import "./XUSD.sol";

contract rewardFiller is AccesorMod {
    // Contracts.
   address[] lpArrays;
    address affection = 0x24F0154C1dCe548AdF15da2098Fdd8B8A3B8151D;
    address xusd = 0xbbeA78397d4d4590882EFcc4820f03074aB2AB29;
    address public staking = 0xa5255A4E00d4e2762EA7e9e1Dc4Ecf68b981e760;
    uint public rewards;
    event SakingContractRefilled(uint timestamp, uint amount);




      constructor(
        address access
    ) AccesorMod( access) {
       rewards = 1000000 * 1e18;
    }



    function keeperProcess(
   
       
    ) external  onlyConsul {

        uint balance = IERC20(xusd).balanceOf(staking);
        if(balance <= 500000 * 1e18){
        XUSD(xusd).mint(staking, rewards);
        }

        emit SakingContractRefilled(block.timestamp, rewards);
      
 }

 function changeAmount(uint _rewards) external onlyConsul(){
    rewards = _rewards;
 }


}