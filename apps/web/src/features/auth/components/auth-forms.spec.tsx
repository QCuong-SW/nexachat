import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LoginForm } from './login-form';
import { RegisterForm } from './register-form';

describe('LoginForm validation', () => {
  it('shows validation errors for invalid email and empty password', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<LoginForm onSubmitCredentials={onSubmit} />);

    await user.type(screen.getByLabelText('Email'), 'invalid-email');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(
      await screen.findByText('Địa chỉ email không hợp lệ.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Vui lòng nhập mật khẩu.'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits valid credentials', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onSubmitCredentials={onSubmit} />);

    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Mật khẩu'), 'StrongPass123!');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(onSubmit).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'StrongPass123!',
    });
  });
});

describe('RegisterForm validation', () => {
  it('shows Free Tier privacy notice and validates password length & mismatch', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<RegisterForm onSubmitRegistration={onSubmit} />);

    expect(screen.getByText(/Lưu ý quyền riêng tư/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Tên hiển thị'), 'A');
    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Mật khẩu'), 'short');
    await user.type(screen.getByLabelText('Xác nhận mật khẩu'), 'different');
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(
      await screen.findByText('Tên hiển thị phải có ít nhất 2 ký tự.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Mật khẩu phải có ít nhất 8 ký tự.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Mật khẩu xác nhận không khớp.'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
