import { describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import NumberField from './NumberField.svelte';
import '../../routes/layout.css';

type Value = number | null;

/** Renders the field with a live value the test can read back. */
function mount(props: {
	value: Value;
	min?: number;
	max?: number;
	step?: number;
	optional?: boolean;
}) {
	// Reactive, as a bound $state would be in the app.
	const state = $state({ value: props.value });
	const result = render(NumberField, {
		props: {
			...props,
			label: 'Amount',
			get value() {
				return state.value;
			},
			set value(next: Value) {
				state.value = next;
			}
		}
	});
	return { ...result, state };
}

const field = () => page.getByRole('spinbutton', { name: 'Amount' });
const stepButtons = (container: HTMLElement) =>
	[...container.querySelectorAll<HTMLButtonElement>('.steps button')] as [
		HTMLButtonElement,
		HTMLButtonElement
	];

describe('NumberField', () => {
	it('hides the browser spinner and draws its own steppers', async () => {
		const { container } = mount({ value: 2 });
		await expect.element(field()).toHaveValue(2);
		const input = field().element();
		expect(getComputedStyle(input).appearance).toBe('textfield');
		expect(stepButtons(container)).toHaveLength(2);
	});

	it('steps up and down with its buttons, stopping at the limits', async () => {
		const { container, state } = mount({ value: 7, min: 1, max: 8 });
		const [up, down] = stepButtons(container);
		await userEvent.click(up);
		expect(state.value).toBe(8);
		await expect.element(field()).toHaveValue(8);
		expect(up.disabled).toBe(true);
		await userEvent.click(down);
		expect(state.value).toBe(7);
	});

	it('steps in tenths without floating-point fuzz', async () => {
		const { container, state } = mount({ value: 0, min: 0, max: 1, step: 0.1 });
		const [up] = stepButtons(container);
		await userEvent.click(up);
		await userEvent.click(up);
		await userEvent.click(up);
		expect(state.value).toBe(0.3);
	});

	it('steps from the keyboard with the arrow keys', async () => {
		const { state } = mount({ value: 3, min: 1, max: 8 });
		await userEvent.click(field());
		await userEvent.keyboard('{ArrowUp}{ArrowUp}');
		expect(state.value).toBe(5);
	});

	it('pulls a typed number back inside the limits when you leave the field', async () => {
		const { state } = mount({ value: 3, min: 1, max: 8 });
		await userEvent.fill(field(), '40');
		await userEvent.tab();
		expect(state.value).toBe(8);
		await expect.element(field()).toHaveValue(8);
	});

	it('can be emptied when optional, meaning no value', async () => {
		const { state } = mount({ value: 25, min: 1, optional: true });
		await userEvent.clear(field());
		await userEvent.tab();
		expect(state.value).toBeNull();
		await expect.element(field()).toHaveValue(null);
	});

	it('refills a required field that was emptied', async () => {
		const { state } = mount({ value: 4, min: 1, max: 8 });
		await userEvent.clear(field());
		await userEvent.tab();
		expect(state.value).toBe(4);
		await expect.element(field()).toHaveValue(4);
	});

	it('starts an empty optional field from its lowest value', async () => {
		const { container, state } = mount({ value: null, min: 1, optional: true });
		await userEvent.click(stepButtons(container)[0]);
		expect(state.value).toBe(1);
	});
});
