const mockAuthContent = jest.fn(() => null);
const mockLoadingOverlay = jest.fn(() => null);

jest.mock('../components/Auth/AuthContent', () => {
	return function MockAuthContent(props) {
		mockAuthContent(props);
		return null;
	};
});

jest.mock('../components/UI/LoadingOverlay', () => {
	return function MockLoadingOverlay(props) {
		mockLoadingOverlay(props);
		return null;
	};
});

jest.mock('../utils/auth', () => ({
	login: jest.fn(),
}));

jest.mock('../store/auth-context', () => {
	const React = require('react');

	return {
		AuthContext: React.createContext({}),
	};
});

import React from 'react';
import { Alert } from 'react-native';
import { act, create } from 'react-test-renderer';

import LoginScreen from '../screens/AuthScreens/LoginScreen';
import { AuthContext } from '../store/auth-context';
import { login } from '../utils/auth';

describe('LoginScreen', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
	});

	afterEach(() => {
		Alert.alert.mockRestore();
	});

	async function renderScreen(contextValue) {
		await act(async () => {
			create(
				<AuthContext.Provider value={contextValue}>
					<LoginScreen />
				</AuthContext.Provider>
			);
		});
	}

	function getAuthContentProps() {
		return mockAuthContent.mock.calls[mockAuthContent.mock.calls.length - 1][0];
	}

	it('authenticates the user when login succeeds', async () => {
		const authenticate = jest.fn();
		login.mockResolvedValue({
			status: 200,
			headers: {
				authorization: 'Bearer token',
			},
			data: {
				data: {
					id: '42',
					email: 'waldo@example.com',
					username: 'waldo',
					finished_tutorial: true,
					score_id: 'score-1',
					is_paid: false,
					paid_tier: 0,
					paid_expires_at: null,
					is_group_owner: false,
					active_group_id: null,
				},
			},
		});

		await renderScreen({ authenticate });

		await act(async () => {
			await getAuthContentProps().onAuthenticate({
				email: 'waldo@example.com',
				password: 'secret',
			});
		});

		expect(login).toHaveBeenCalledWith({
			email: 'waldo@example.com',
			password: 'secret',
		});
		expect(authenticate).toHaveBeenCalledWith({
			token: 'Bearer token',
			userId: '42',
			email: 'waldo@example.com',
			username: 'waldo',
			isTutorialFinished: true,
			scoreId: 'score-1',
			isPaid: false,
			paidTier: 0,
			paidExpiresAt: null,
			isGroupOwner: false,
			activeGroupId: null,
		});
	});

	it('forwards paid + group entitlement fields from the login response to authenticate', async () => {
		const authenticate = jest.fn();
		login.mockResolvedValue({
			status: 200,
			headers: {
				authorization: 'Bearer premium-token',
			},
			data: {
				data: {
					id: '42',
					email: 'waldo@example.com',
					username: 'waldo',
					finished_tutorial: true,
					score_id: 'score-1',
					is_paid: true,
					paid_tier: 2,
					paid_expires_at: '2099-01-01T00:00:00Z',
					is_group_owner: true,
					active_group_id: 'group-7',
				},
			},
		});

		await renderScreen({ authenticate });

		await act(async () => {
			await getAuthContentProps().onAuthenticate({
				email: 'waldo@example.com',
				password: 'secret',
			});
		});

		expect(authenticate).toHaveBeenCalledWith({
			token: 'Bearer premium-token',
			userId: '42',
			email: 'waldo@example.com',
			username: 'waldo',
			isTutorialFinished: true,
			scoreId: 'score-1',
			isPaid: true,
			paidTier: 2,
			paidExpiresAt: '2099-01-01T00:00:00Z',
			isGroupOwner: true,
			activeGroupId: 'group-7',
		});
	});

	it('shows an invalid credentials alert when the backend rejects the login', async () => {
		login.mockResolvedValue({ status: 401 });

		await renderScreen({ authenticate: jest.fn() });

		await act(async () => {
			await getAuthContentProps().onAuthenticate({
				email: 'waldo@example.com',
				password: 'bad-password',
			});
		});

		expect(Alert.alert).toHaveBeenCalledWith(
			'Invalid credentials, please retry',
			expect.stringContaining('Change your email or password before retrying')
		);
	});

	it('renders the loading overlay while authentication is in flight', async () => {
		let resolveLogin;
		login.mockReturnValue(
			new Promise((resolve) => {
				resolveLogin = resolve;
			})
		);

		await renderScreen({ authenticate: jest.fn() });

		await act(async () => {
			getAuthContentProps().onAuthenticate({
				email: 'waldo@example.com',
				password: 'secret',
			});
			await Promise.resolve();
		});

		expect(mockLoadingOverlay).toHaveBeenCalledWith({ message: 'Authenticating...' });

		await act(async () => {
			resolveLogin({ status: 500 });
			await Promise.resolve();
		});
	});
});