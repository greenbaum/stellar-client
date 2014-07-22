'use strict';

var sc = angular.module('stellarClient');

sc.controller('DashboardCtrl', function($rootScope, $scope, $timeout, $state, session, TutorialHelper) {
    $rootScope.tab = 'none';

    $scope.showTransaction = false;
    $scope.newTransaction = null;
    $scope.username = session.get('username');
    $scope.tutorials = TutorialHelper;

    $scope.closePane = function(){
      $rootScope.tab = 'none';
    };

    $scope.openSend = function() {
        $scope.$broadcast('resetSendPane');
        $rootScope.tab = 'send';
        TutorialHelper.clear('dashboard');
    };

    $scope.openReceive = function() {
        $rootScope.tab = 'receive';
    };

    $scope.statusMessage = function(){
        switch($rootScope.accountStatus){
          case 'connecting': return 'Connecting...';
          case 'loaded':     return 'Connected!';
          case 'error':      return 'Connection error!';
        }
    };

    var cleanupTimer = null;

    // Show a notification when new transactions are received.
    $scope.$on('$appTxNotification', function(event, tx){
        if (tx.type == 'received') {
            $scope.showTransaction = true;
            $scope.newTransaction = tx;

            if (cleanupTimer) {
                $timeout.cancel(cleanupTimer);
            }

            cleanupTimer = $timeout(function () {
                $scope.showTransaction = false;
                cleanupTimer = null;
            }, 10000);
        }
    });

    // Dismiss the transaction notification.
    $scope.clearNotification = function() {
        $timeout.cancel(cleanupTimer);
        $scope.showTransaction = false;
    };
});



