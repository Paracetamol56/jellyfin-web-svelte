export interface Toast {
	id: number;
	message: string;
	tone: 'info' | 'error';
	action?: { label: string; run: () => void };
}

class Toasts {
	list = $state<Toast[]>([]);
	private next = 1;

	show(message: string, opts: { tone?: Toast['tone']; action?: Toast['action']; ms?: number } = {}): void {
		const t: Toast = { id: this.next++, message, tone: opts.tone ?? 'info', action: opts.action };
		this.list = [...this.list.slice(-3), t];
		setTimeout(() => this.dismiss(t.id), opts.ms ?? (opts.action ? 6000 : 3500));
	}

	error(message: string): void {
		this.show(message, { tone: 'error', ms: 6000 });
	}

	dismiss(id: number): void {
		this.list = this.list.filter((t) => t.id !== id);
	}
}

export const toasts = new Toasts();
