(function () {
  const SUPPORTED_EVENTS = ['click', 'input', 'change', 'keydown'];

  function dispatchDeclarativeEvent(domEvent, attrName) {
    const selector = `[${attrName}]`;
    const target = domEvent.target instanceof Element ? domEvent.target.closest(selector) : null;
    if (!target || (target instanceof HTMLButtonElement && target.disabled)) {
      return;
    }

    const expression = target.getAttribute(attrName);
    if (!expression) {
      return;
    }

    try {
      const handler = new Function('event', expression);
      handler.call(target, domEvent);
    } catch (error) {
      console.error(`Failed to execute declarative handler: ${attrName}`, expression, error);
    }
  }

  SUPPORTED_EVENTS.forEach((eventName) => {
    const attrName = `data-on${eventName}`;
    document.addEventListener(eventName, (domEvent) => dispatchDeclarativeEvent(domEvent, attrName));
  });
})();
