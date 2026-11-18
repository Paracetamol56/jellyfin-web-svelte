// jsdom has no media support: report nothing playable unless a test says otherwise.
HTMLMediaElement.prototype.canPlayType = () => '';
