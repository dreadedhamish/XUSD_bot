// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;


// import "./AccessControl/AccessorMod.sol";
import "./XUSD.sol";



interface IRewardsBank {
    // Events
    event RewardsDeposited(address indexed depositor, uint256 amount);
    event MiddleManZapped(address indexed userAddress, uint256 totalValue, address lpToZapInto);
    event Withdrawn(address indexed user, uint256 amount, uint256 timestamp, uint256 blockNumber);
    event MiddleManSet(address indexed oldMiddleMan, address indexed newMiddleMan);
    event RewardsWithdrawn(address indexed token, uint256 amount);

    // Functions
    /**
     * @notice Sets the MiddleMan contract address.
     * @param _middleMan The address of the MiddleMan contract.
     */
    function setMiddleMan(address _middleMan) external;

    /**
     * @notice Sets the Storage contract address.
     * @param _storage The address of the Storage contract.
     */
    function setStorage(address _storage) external;

    /**
     * @notice Deposits rewards into the contract.
     * @param amount The amount of xUSD tokens to deposit.
     */
    function depositRewards(uint256 amount) external;

    /**
     * @notice Allows a user to withdraw their claimable rewards.
     */
    function withdraw() external;

    /**
     * @notice Allows a user to compound their earnings into a liquidity pool.
     * @param lpToZapInto The address of the liquidity pool to zap into.
     */
    function compoundEarnings(address lpToZapInto) external;

    /**
     * @notice Withdraws any remaining tokens in the contract to the Consul.
     * @param token The address of the token to withdraw.
     */
    function withdrawRewards(address token) external;
}


contract rewardFillerTrading is AccesorMod {
    // Contracts.
   address[] lpArrays;
  
    address xusd = 0xbbeA78397d4d4590882EFcc4820f03074aB2AB29;
    address public bank = 0x3505d69a9956dA594bf1f0a7A2125488F3d9076f;
    uint public rewards;
    event TradingRewardsFilled(uint timestamp, uint amount);




      constructor(
        address access
    ) AccesorMod( access) {
       rewards = 1000000 * 1e18;
    }



    function keeperProcess(
   
       
    ) external  onlyConsul {

        uint balance = IERC20(xusd).balanceOf(bank);
        if(balance <= 500000 * 1e18){
        XUSD(xusd).mint(bank, rewards);
        // uint xusdBalance = IERC20(xusd).balanceOf(address(this));
        // IERC20(xusd).approve(bank, xusdBalance);
        // IRewardsBank(bank).depositRewards(xusdBalance);

        }

        emit TradingRewardsFilled(block.timestamp, rewards);
      
 }

     function withdrawXusd(
   
       
    ) external  onlyPreatormaximus {

        uint balance = IERC20(xusd).balanceOf(address(this));
        IERC20(xusd).transfer(msg.sender, balance);
      

        }


      
 


 function changeAmount(uint _rewards) external onlyConsul(){
    rewards = _rewards;
 }


}