import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';

export type DialogKind = 'info' | 'edit' | 'delete' | 'playlist';

/** One app-wide dialog at a time, opened from menus anywhere. */
class Dialogs {
	kind = $state<DialogKind | null>(null);
	/** Items the dialog acts on (several for "save queue as playlist"). */
	items = $state<BaseItemDto[]>([]);

	open(kind: DialogKind, items: BaseItemDto | BaseItemDto[]): void {
		this.items = Array.isArray(items) ? items : [items];
		this.kind = kind;
	}

	close(): void {
		this.kind = null;
	}
}

export const dialogs = new Dialogs();
