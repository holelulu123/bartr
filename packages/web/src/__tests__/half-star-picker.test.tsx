import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HalfStarPicker } from '@/components/half-star-picker';

afterEach(() => {
  cleanup();
});

describe('HalfStarPicker', () => {
  it('renders 5 stars', () => {
    render(<HalfStarPicker value={3} />);
    const group = screen.getByRole('group');
    expect(group.children).toHaveLength(5);
  });

  it('displays the correct aria label', () => {
    render(<HalfStarPicker value={3.5} />);
    expect(screen.getByRole('group')).toHaveAttribute('aria-label', 'Rating: 3.5 out of 5');
  });

  it('calls onChange with full star value on right-half click', () => {
    const onChange = vi.fn();
    render(<HalfStarPicker value={0} onChange={onChange} />);
    const group = screen.getByRole('group');
    const thirdStar = group.children[2] as HTMLElement;

    const rect = { left: 0, width: 20, top: 0, height: 20, right: 20, bottom: 20, x: 0, y: 0, toJSON: () => {} };
    vi.spyOn(thirdStar, 'getBoundingClientRect').mockReturnValue(rect as DOMRect);
    fireEvent.click(thirdStar, { clientX: 15 });

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('calls onChange with half star value on left-half click', () => {
    const onChange = vi.fn();
    render(<HalfStarPicker value={0} onChange={onChange} />);
    const group = screen.getByRole('group');
    const thirdStar = group.children[2] as HTMLElement;

    const rect = { left: 0, width: 20, top: 0, height: 20, right: 20, bottom: 20, x: 0, y: 0, toJSON: () => {} };
    vi.spyOn(thirdStar, 'getBoundingClientRect').mockReturnValue(rect as DOMRect);
    fireEvent.click(thirdStar, { clientX: 5 });

    expect(onChange).toHaveBeenCalledWith(2.5);
  });

  it('does not call onChange when disabled', () => {
    const onChange = vi.fn();
    render(<HalfStarPicker value={2} onChange={onChange} disabled />);
    const group = screen.getByRole('group');
    const firstStar = group.children[0] as HTMLElement;

    const rect = { left: 0, width: 20, top: 0, height: 20, right: 20, bottom: 20, x: 0, y: 0, toJSON: () => {} };
    vi.spyOn(firstStar, 'getBoundingClientRect').mockReturnValue(rect as DOMRect);
    fireEvent.click(firstStar, { clientX: 5 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not call onChange when readOnly', () => {
    const onChange = vi.fn();
    render(<HalfStarPicker value={2} onChange={onChange} readOnly />);
    const group = screen.getByRole('group');
    const firstStar = group.children[0] as HTMLElement;

    const rect = { left: 0, width: 20, top: 0, height: 20, right: 20, bottom: 20, x: 0, y: 0, toJSON: () => {} };
    vi.spyOn(firstStar, 'getBoundingClientRect').mockReturnValue(rect as DOMRect);
    fireEvent.click(firstStar, { clientX: 5 });
    expect(onChange).not.toHaveBeenCalled();
  });
});
