(function() {

  'use strict';

  if (typeof VeilCompat === 'undefined') return;



  function tuneDesktopChromeAutomation() {

    if (typeof VeilCompat.applyAutomationEnvironment === 'function') {

      VeilCompat.applyAutomationEnvironment();

    }

  }



  VeilCompat.registerTuning('desktop-chrome', '17_low_power', tuneDesktopChromeAutomation);

  VeilCompat.registerTuning('desktop-chrome', '13_auth', tuneDesktopChromeAutomation);

  VeilCompat.registerTuning('desktop-chrome', '29_send_message', tuneDesktopChromeAutomation);



  if (typeof VeilCompat.detectAutomationEnvironment === 'function' &&

      VeilCompat.detectAutomationEnvironment()) {

    tuneDesktopChromeAutomation();

  }

})();

