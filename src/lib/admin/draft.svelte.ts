/** Editable copy of a server object with dirty tracking (settings forms). */
export class Draft<T extends object> {
	value = $state<T | null>(null);
	private base = $state('');
	saving = $state(false);

	get dirty(): boolean {
		return this.value != null && JSON.stringify(this.value) !== this.base;
	}

	load(v: T): void {
		this.base = JSON.stringify(v);
		this.value = JSON.parse(this.base);
	}

	reset(): void {
		if (this.base) this.value = JSON.parse(this.base);
	}

	/** Run `save` with the current value; on success the saved value becomes the new baseline. */
	async commit(save: (v: T) => Promise<unknown>): Promise<boolean> {
		if (!this.value) return false;
		this.saving = true;
		try {
			const snapshot = JSON.parse(JSON.stringify(this.value)) as T;
			await save(snapshot);
			this.load(snapshot);
			return true;
		} finally {
			this.saving = false;
		}
	}
}
