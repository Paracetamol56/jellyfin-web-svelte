export interface ConfirmRequest {
	title: string;
	body?: string;
	confirmLabel?: string;
	destructive?: boolean;
	/** Ask for a value (e.g. a message to send); returned instead of `true`. */
	input?: { label: string; placeholder?: string; multiline?: boolean };
}

class ConfirmState {
	request = $state<ConfirmRequest | null>(null);
	private resolver: ((v: string | boolean) => void) | null = null;

	ask(r: ConfirmRequest): Promise<string | boolean> {
		this.resolver?.(false);
		this.request = r;
		return new Promise((res) => (this.resolver = res));
	}

	settle(v: string | boolean): void {
		this.resolver?.(v);
		this.resolver = null;
		this.request = null;
	}
}

export const confirmState = new ConfirmState();
/** Promise-based confirmation dialog: `if (await confirm({...})) …` */
export const confirm = (r: ConfirmRequest) => confirmState.ask(r);
