// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

//import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
//import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "./Context.sol";
import "@openzeppelin/contracts/utils/structs/Checkpoints.sol";
import "./VibeRegistry.sol";
import "./AccessControl/AccessorMod.sol";

contract XUSD is Context, IERC20, AccesorMod {
    using Checkpoints for Checkpoints.Trace224; // Using Checkpoints library for tracking burn history

    // Storage
    mapping(address => uint32[]) private _burnBlockNumbersEOA;
    mapping(address => uint32[]) private _burnBlockNumbersContract;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    mapping(address => uint256) internal _contractBurnBalances;
    mapping(address => uint256) internal _eoaBurnBalances;
    mapping(address => Checkpoints.Trace224) private _burnCheckpointsEOA;
    mapping(address => Checkpoints.Trace224) private _burnCheckpointsContract;
    uint256 internal _totalBurnedEOA;
    uint256 internal _totalBurnedContract;
    uint private burnIt = 700;
    uint private bankIt = 300;
    address tressury;
    uint256 private _totalSupply;
    uint256 internal _totalBurned;
    string private _name;
    string private _symbol;
    bool private tradingOpen;
    bool private paid = false;
    bool private swapEnabled = false;
    mapping(address => bool) private _isExcludedFromTax;
    address public immutable burnAddress =
    0x0000000000000000000000000000000000000369;

    VibeRegistry public registry;

    // Constructor
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialBalance_,
        address _access,
        address t
    ) AccesorMod(_access)  {
        require(initialBalance_ > 0, "Initial supply cannot be zero");
        tressury = t;
        _name = name_;
        _symbol = symbol_;
        _mint(_msgSender(), initialBalance_);
    }

    // View function to return burn balance of a user (Contracts)
    function burnBalanceContract(
        address contractAddr
    ) public view returns (uint256) {
        return _contractBurnBalances[contractAddr];
    }

    // View function to return burn balance of a user (EOAs)
    function burnBalanceEOA(address user) public view returns (uint256) {
        return _eoaBurnBalances[user];
    }

    // Returns the total amount burned (combining EOAs and contracts)
    function totalBurned() external view returns (uint256) {
        return _totalBurnedEOA + _totalBurnedContract;
    }

    // // Returns the name of the token
    // function name() public view virtual override returns (string memory) {
    //     return _name;
    // }

    // // Returns the symbol of the token
    // function symbol() public view virtual override returns (string memory) {
    //     return _symbol;
    // }

    // // Returns the number of decimals (defaults to 18)
    // function decimals() public view virtual override returns (uint8) {
    //     return 18;
    // }

    // Returns total supply of tokens
    function totalSupply() public view virtual override returns (uint256) {
        return _totalSupply;
    }

    // Returns the balance of a specific account
    function balanceOf(
        address account
    ) public view virtual override returns (uint256) {
        return _balances[account];
    }

    // Returns allowance granted to spender by _owner
    function allowance(
        address _owner,
        address spender
    ) public view virtual override returns (uint256) {
        return _allowances[_owner][spender];
    }

    function setTreasury(address t) external onlyConsul() {
        tressury = t;

    }

    function setTaxVariable(uint treasury, uint burn) external onlyConsul() {
        burnIt = burn;
        bankIt = treasury;

    }

    // Approves a spender
    function approve(
        address spender,
        uint256 amount
    ) public virtual override returns (bool) {
        address _owner = _msgSender();
        _approve(_owner, spender, amount);
        return true;
    }

    // Increase allowance
    function increaseAllowance(
        address spender,
        uint256 addedValue
    ) public virtual returns (bool) {
        address _owner = _msgSender();
        _approve(_owner, spender, allowance(_owner, spender) + addedValue);
        return true;
    }

    // Decrease allowance
    function decreaseAllowance(
        address spender,
        uint256 subtractedValue
    ) public virtual returns (bool) {
        address _owner = _msgSender();
        uint256 currentAllowance = allowance(_owner, spender);
        require(
            currentAllowance >= subtractedValue,
            "Decreased allowance below zero"
        );
        unchecked {
            _approve(_owner, spender, currentAllowance - subtractedValue);
        }
        return true;
    }

    // Internal mint logic
    function _mint(address account, uint256 amount) internal virtual {
        require(account != address(0), "Mint to zero address");
        _totalSupply += amount;
        unchecked {
            _balances[account] += amount;
        }
        emit Transfer(address(0), account, amount);
    }

    // Approve function
    function _approve(
        address _owner,
        address spender,
        uint256 amount
    ) internal virtual {
        require(_owner != address(0), "Approve from zero address");
        require(spender != address(0), "Approve to zero address");
        _allowances[_owner][spender] = amount;
        emit Approval(_owner, spender, amount);
    }

// Transfer function with tax deduction and burn logic
    function transfer(
        address to,
        uint256 amount
    ) public virtual override nonReentrant returns (bool) {
        address _owner = _msgSender();

        // Calculate the tax fee and adjusted amount
        (int fee, uint256 adjustedAmount) = registry.calculateAndSumBasis(
            to,
            _owner,
            tx.origin,
            msg.sender,
            amount
        );

        // Only apply tax if fee is positive and both 'from' and 'to' are not excluded
        if (fee > 0 && !_isExcludedFromTax[_owner] && !_isExcludedFromTax[to]) {
            uint256 taxAmount = (adjustedAmount * uint256(fee)) / 10000;

            if (taxAmount > 0) {
                uint burnAmount = (taxAmount * burnIt) / 10000;
                uint tAmount = taxAmount - burnAmount;

                // Burn the tokens by sending to the zero address
                if (burnAmount > 0) {
                    _transfer(_owner, address(0), burnAmount);
                }

                // Send tax to the treasury
                if (tAmount > 0) {
                    _transfer(_owner, tressury, tAmount);
                }

                // Adjust the amount after the tax deduction
                adjustedAmount -= taxAmount;
            }
        }

        // Always transfer the remaining (adjusted) amount to the recipient
        _transfer(_owner, to, adjustedAmount);
        return true;
    }

    // Similar tax handling for transferFrom
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override nonReentrant returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, amount);

        (int fee, uint256 adjustedAmount) = registry.calculateAndSumBasis(
            to,
            from,
            tx.origin,
            spender,
            amount
        );

        // Only apply tax if fee is positive and both 'from' and 'to' are not excluded
        if (fee > 0 && !_isExcludedFromTax[from] && !_isExcludedFromTax[to]) {
            uint256 taxAmount = (adjustedAmount * uint256(fee)) / 10000;

            if (taxAmount > 0) {
                uint burnAmount = (taxAmount * burnIt) / 10000;
                uint tAmount = taxAmount - burnAmount;

                // Handle burn amount
                if (burnAmount > 0) {
                    _transfer(from, address(0), burnAmount); // Burn the tax amount
                }

                // Handle treasury amount
                if (tAmount > 0) {
                    _transfer(from, tressury, tAmount); // Send to treasury
                }

                // Adjust the amount after the tax
                adjustedAmount -= taxAmount;
            }
        }

        // Transfer the adjusted amount (or the original amount if no fee)
        _transfer(from, to, adjustedAmount);

        return true;
    }

    // Internal transfer function
    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {
        require(from != address(0), "Transfer from zero address");

        if (to == address(0) || to == burnAddress) {
            // Burning tokens
            if (isContract(from)) {
                _contractBurnBalances[from] += amount;
                _totalBurnedContract += amount;
                _updateBurnHistoryContract(from, amount);
            } else {
                _eoaBurnBalances[tx.origin] += amount;
                _totalBurnedEOA += amount;
                _updateBurnHistoryEOA(tx.origin, amount);
            }

            _burn(from, amount);
        } else {
            uint256 fromBalance = _balances[from];
            require(fromBalance >= amount, "Transfer amount exceeds balance");
            unchecked {
                _balances[from] = fromBalance - amount;
                _balances[to] += amount;
            }
            emit Transfer(from, to, amount);
        }
    }

    // Internal burn function
    function _burn(address from, uint256 amount) internal virtual {
        uint256 fromBalance = _balances[from];
        require(fromBalance >= amount, "Burn amount exceeds balance");
        unchecked {
            _balances[from] = fromBalance - amount;
            _totalSupply -= amount;
        }
        emit Transfer(from, address(0), amount);
    }

    // Burn history tracking for EOAs
    function _updateBurnHistoryEOA(address user, uint256 amount) internal {
        uint224 currentBurnAmount = uint224(_eoaBurnBalances[user]);
        uint224 newBurnAmount = currentBurnAmount + uint224(amount);
        uint32 blockNumber = uint32(block.number);

        _burnCheckpointsEOA[user].push(blockNumber, newBurnAmount);

        // Track the block number for the user
        _burnBlockNumbersEOA[user].push(blockNumber);
    }

    // Burn history tracking for Contracts
    function _updateBurnHistoryContract(
        address contractAddress,
        uint256 amount
    ) internal {
        uint224 currentBurnAmount = uint224(
            _contractBurnBalances[contractAddress]
        );
        uint224 newBurnAmount = currentBurnAmount + uint224(amount);
        uint32 blockNumber = uint32(block.number);

        _burnCheckpointsContract[contractAddress].push(
            blockNumber,
            newBurnAmount
        );

        // Track the block number for the contract
        _burnBlockNumbersContract[contractAddress].push(blockNumber);
    }

    // View latest burn for EOAs
    function getLatestBurnEOA(address user) public view returns (uint224) {
        return _burnCheckpointsEOA[user].latest();
    }

    function getFullBurnHistoryEOA(
        address user
    ) public view returns (uint32[] memory blocks, uint224[] memory burns) {
        uint32[] memory blockNumbers = _burnBlockNumbersEOA[user];
        uint224[] memory burnAmounts = new uint224[](blockNumbers.length);

        for (uint256 i = 0; i < blockNumbers.length; i++) {
            burnAmounts[i] = _burnCheckpointsEOA[user].upperLookup(
                blockNumbers[i]
            );
        }

        return (blockNumbers, burnAmounts);
    }

    // Get the full burn history for a contract
    function getFullBurnHistoryContract(
        address contractAddr
    ) public view returns (uint32[] memory blocks, uint224[] memory burns) {
        uint32[] memory blockNumbers = _burnBlockNumbersContract[contractAddr];
        uint224[] memory burnAmounts = new uint224[](blockNumbers.length);

        for (uint256 i = 0; i < blockNumbers.length; i++) {
            burnAmounts[i] = _burnCheckpointsContract[contractAddr].upperLookup(
                blockNumbers[i]
            );
        }

        return (blockNumbers, burnAmounts);
    }

    // View latest burn for contracts
    function getLatestBurnContract(
        address contractAddr
    ) public view returns (uint224) {
        return _burnCheckpointsContract[contractAddr].latest();
    }

    // Utility to check if an address is a contract
    function isContract(address account) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }

    // Exclude accounts from tax
    function setExclusionFromTax(
        address account,
        bool status
    ) external onlySenator {
        _isExcludedFromTax[account] = status;
    }

    function isExcludedFromTax(address account) public view returns (bool) {
        return _isExcludedFromTax[account];
    }

    // Set registry contract address
    function setRegistry(address reg) public onlySenator {
        require(isContract(reg), "Provided address is not a contract");
        registry = VibeRegistry(reg);
    }

    // Reward transfer function
    function Rewardtransfer(
        address to,
        uint256 amount
    ) external onlyConsul nonReentrant {
        _transfer(_msgSender(), to, amount);
    }

    // Mint new tokens
    function mint(address to, uint256 amount) public onlyConsul {
        _mint(to, amount);
    }

    // Spend allowance
    function _spendAllowance(
        address _owner,
        address spender,
        uint256 amount
    ) internal virtual {
        uint256 currentAllowance = allowance(_owner, spender);
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "Insufficient allowance");
            unchecked {
                _approve(_owner, spender, currentAllowance - amount);
            }
        }
    }
}
