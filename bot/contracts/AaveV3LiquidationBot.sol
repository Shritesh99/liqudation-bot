// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@aave/core-v3/contracts/dependencies/openzeppelin/contracts/IERC20.sol";
import {SafeERC20} from "@aave/core-v3/contracts/dependencies/openzeppelin/contracts/SafeERC20.sol";
import {FlashLoanSimpleReceiverBase} from "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import {IPool} from "@aave/core-v3/contracts/interfaces/IPool.sol";
import {IPoolAddressesProvider} from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";


contract AaveV3LiquidationBot is FlashLoanSimpleReceiverBase {
    using SafeERC20 for IERC20;

    event LiquidationFailed(
        address indexed borrower,
        address indexed collateralAsset,
        address indexed debtAsset,
        string reason,
        uint256 timestamp
    );

    event ProfitsWithdrawn(address indexed token, uint256 amount, address indexed recipient);

    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address _addressProvider) FlashLoanSimpleReceiverBase(IPoolAddressesProvider(_addressProvider)) {
        owner = msg.sender;
    }

    function liquidateWithFlashLoan(
        address borrower,
        address collateralAsset,
        address debtAsset,
        uint256 debtToCover
    ) external onlyOwner {
        bytes memory params = abi.encode(borrower, collateralAsset, debtAsset);

        POOL.flashLoanSimple(
            address(this),
            debtAsset,
            debtToCover,
            params,
            0
        );
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        (address borrower, address collateralAsset, address debtAsset) = 
            abi.decode(params, (address, address, address));

        bool success = false;
        string memory failureReason = "";

        try this._performLiquidation(
            borrower,
            collateralAsset,
            debtAsset,
            amount
        ) {
            success = true;
        } catch Error(string memory reason) {
            failureReason = reason;
            success = false;
        }

        if (!success) {
            emit LiquidationFailed(borrower, collateralAsset, debtAsset, failureReason, block.timestamp);
        }

        uint256 amountOwed = amount + premium;

        require(
            IERC20(asset).balanceOf(address(this)) >= amountOwed,
            "Insufficient funds to repay flash loan"
        );

        IERC20(asset).safeApprove(address(POOL), amountOwed);

        return true;
    }

    function _performLiquidation(
        address borrower,
        address collateralAsset,
        address debtAsset,
        uint256 debtAmount
    ) external {
        IERC20(debtAsset).safeApprove(address(POOL), debtAmount);

        POOL.liquidationCall(
            collateralAsset,
            debtAsset,
            borrower,
            debtAmount,
            false
        );
    }

    function withdrawProfits(address token, uint256 amount) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance >= amount, "LiquidationBot: Insufficient balance");

        IERC20(token).safeTransfer(msg.sender, amount);
        emit ProfitsWithdrawn(token, amount, msg.sender);
    }

    function withdrawAllProfits(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "LiquidationBot: No balance");

        IERC20(token).safeTransfer(msg.sender, balance);
        emit ProfitsWithdrawn(token, balance, msg.sender);
    }

    function withdrawETH() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    receive() external payable {}
}
