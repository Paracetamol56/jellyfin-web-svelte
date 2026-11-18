/** A data series in a bar or line chart. */
export interface Series {
	key: string;
	label: string;
	color: string;
}
/** One slice of a donut. */
export interface Slice {
	label: string;
	value: number;
	color: string;
}
