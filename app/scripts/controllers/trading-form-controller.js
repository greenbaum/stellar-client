var sc = angular.module('stellarClient');

sc.controller('TradingFormCtrl', function($scope, session, singletonPromise, FlashMessages) {
  // Populate the currency lists from the wallet's gateways.
  var gateways = session.get('wallet').get('mainData', 'gateways', []);
  var gatewayCurrencies = _.flatten(_.pluck(gateways, 'currencies'));
  $scope.currencies = [{currency:"STR"}].concat(gatewayCurrencies);
  $scope.currencyNames = _.uniq(_.pluck($scope.currencies, 'currency'));
  var MAX_STR_AMOUNT = new BigNumber(2).toPower(64).minus(1).dividedBy('1000000'); // (2^64-1)/10^6
  var MAX_CREDIT_PRECISION = 14; // stellard credits supports up to 15 significant digits


  $scope.$watch('formData.baseAmount', calculateCounterAmount);
  $scope.$watch('formData.unitPrice', calculateCounterAmount);

  $scope.changeBaseCurrency = function(newCurrency) {
    $scope.formData.baseCurrency = {
      currency: newCurrency,
      issuer: $scope.getIssuers(newCurrency)[0]
    };
  };

  $scope.changeCounterCurrency = function(newCurrency) {
    $scope.formData.counterCurrency = {
      currency: newCurrency,
      issuer: $scope.getIssuers(newCurrency)[0]
    };
  };

  function calculateCounterAmount() {
    $scope.formData.counterAmount = new BigNumber($scope.formData.baseAmount).times($scope.formData.unitPrice).toString();
  }

  $scope.getIssuers = function(currency) {
    var currencies = _.filter($scope.currencies, {currency: currency});
    var issuers = _.pluck(currencies, 'issuer');

    return issuers;
  };

  $scope.setBaseIssuer = function(issuer) {
    $scope.formData.baseCurrency.issuer = issuer;
  };

  $scope.setCounterIssuer = function(issuer) {
    $scope.formData.counterCurrency.issuer = issuer;
  };

  $scope.confirmOffer = function() {
    $scope.state = 'confirm';
  };

  $scope.editForm = function() {
    $scope.state = 'form';
  };

  $scope.resetForm = function() {
    $scope.state = 'form';
    $scope.formData.tradeOperation = 'buy';

    $scope.clearForm();

    $scope.$broadcast('trading-form-controller:reset');
  };

  $scope.clearForm = function() {
    $scope.resetAmounts();

    $scope.formData.baseCurrency = {
      currency: null,
      issuer: null
    };

    $scope.formData.counterCurrency = {
      currency: null,
      issuer: null
    };

    $scope.formData.favorite = null;
    $scope.offerError = '';
  };

  $scope.resetAmounts = function() {
    $scope.formData.baseAmount = null;
    $scope.formData.unitPrice = null;
    $scope.formData.counterAmount = null;

    $scope.formIsFilled = false;
    $scope.formIsValid = false;
    $scope.formErrorMessage = '';
  };

  $scope.resetForm();

  $scope.$watch('formData.baseAmount', validateForm);
  $scope.$watch('formData.counterAmount', validateForm);
  $scope.$watch('formData.baseCurrency', validateForm);
  $scope.$watch('formData.counterCurrency', validateForm);

  function validateForm() {
    $scope.formIsFilled = isFormFilled();

    var baseAmount    = _.extend({value: $scope.formData.baseAmount}, $scope.formData.baseCurrency);
    var counterAmount = _.extend({value: $scope.formData.counterAmount}, $scope.formData.counterCurrency);

    if (isValidTradeAmount(baseAmount) && isValidTradeAmount(counterAmount)) {
      $scope.formIsValid = true;
    } else {
      $scope.formIsValid = false;
    }
  }

  function isFormFilled() {
    if (!$scope.currentOrderBook) { return false; }

    if (!$scope.formData.baseCurrency.currency) { return false; }
    if (!$scope.formData.counterCurrency.currency) { return false; }

    if (!$scope.formData.baseAmount) { return false; }
    if (!$scope.formData.unitPrice) { return false; }
    if (!$scope.formData.counterAmount) { return false; }

    return true;
  }

  function isValidTradeAmount(amount) {
    if (amount.value === null) {
      return false;
    }

    var value;
    try {
      value = new BigNumber(amount.value);
    } catch (e) {
      $scope.formErrorMessage = 'Error parsing amount: ' + amount.value;
      return false;
    }

    var amountNegative    = value.lessThanOrEqualTo(0);
    var STRBoundsError    = amount.currency === "STR" && value.greaterThan(MAX_STR_AMOUNT);
    var STRPrecisionError = amount.currency === "STR" && !value.equals(value.toFixed(6));
    var creditBoundsError = amount.currency !== "STR" && value.c.length > MAX_CREDIT_PRECISION;

    if (amountNegative) {
      $scope.formErrorMessage = amount.currency + ' amount must be a positive number';
    } else if (STRBoundsError) {
      $scope.formErrorMessage = 'STR amount is too large: ' + value.toString();
    } else if (STRPrecisionError) {
      $scope.formErrorMessage = 'STR amount has too many decimals: ' + value.toString();
    } else if (creditBoundsError) {
      $scope.formErrorMessage = amount.currency + ' amount has too much precision: ' + value.toString();
    } else {
      return true;
    }

    return false;
  }

  $scope.createOffer = singletonPromise(function(e) {
    var offerPromise;

    if ($scope.formData.tradeOperation === 'buy') {
      offerPromise = $scope.currentOrderBook.buy($scope.formData.baseAmount, $scope.formData.counterAmount);
    } else {
      offerPromise = $scope.currentOrderBook.sell($scope.formData.baseAmount, $scope.formData.counterAmount);
    }

    $scope.state = 'sending';
    
    return offerPromise
      .then(function() {
        if($scope.state === 'sending') {
          $scope.state = 'sent';
        } else {
          FlashMessages.add({
            title: 'Success!',
            info: 'Offer created.',
            type: 'success'
          });
        }
      })
      .catch(function(e) {
        if($scope.state === 'sending') {
          $scope.state = 'error';
          $scope.offerError = e.engine_result_message;
        } else {
          FlashMessages.add({
            title: 'Unable to create offer!',
            info: e.engine_result_message,
            type: 'error'
          });
        }
      });
  });
});