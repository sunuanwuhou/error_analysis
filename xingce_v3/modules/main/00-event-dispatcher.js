(function () {
  const SUPPORTED_EVENTS = ['click', 'input', 'change', 'keydown'];

  function executeDeclarativeHandler(target, domEvent, expression) {
    const handler = new Function('event', expression);
    handler.call(target, domEvent);
  }

  async function dispatchDeclarativeEvent(domEvent, attrName) {
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
      executeDeclarativeHandler(target, domEvent, expression);
    } catch (error) {
      const resolver = (typeof window !== 'undefined') ? window.__resolveDeclarativeHandler : null;
      if (typeof resolver === 'function') {
        try {
          const resolved = await resolver({ attrName, expression, error, target, domEvent });
          if (resolved) {
            executeDeclarativeHandler(target, domEvent, expression);
            return;
          }
        } catch (resolveError) {
          console.warn(`Declarative handler resolver failed: ${attrName}`, expression, resolveError);
        }
      }
      console.error(`Failed to execute declarative handler: ${attrName}`, expression, error);
    }
  }

  SUPPORTED_EVENTS.forEach((eventName) => {
    const attrName = `data-on${eventName}`;
    document.addEventListener(eventName, (domEvent) => {
      void dispatchDeclarativeEvent(domEvent, attrName);
    });
  });
})();
