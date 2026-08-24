import {useEffect, useRef, useState} from 'react';
import type {ServerMessage, ClientMessage} from '../types';

interface UseWebSocketOptions {
	onMessage?: (message: ServerMessage) => void;
	onConnect?: () => void;
	onDisconnect?: () => void;
	onError?: (error: Event) => void;
}

export function useWebSocket(url: string, options: UseWebSocketOptions = {}) {
	const {onMessage, onConnect, onDisconnect, onError} = options;
	const wsRef = useRef<WebSocket | null>(null);
	const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const [isConnected, setIsConnected] = useState(false);
	const [isConnecting, setIsConnecting] = useState(false);

	const connect = () => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			return;
		}

		setIsConnecting(true);

		try {
			const wsUrl =
				url.startsWith('ws://') || url.startsWith('wss://')
					? url
					: `ws://${window.location.host}/ws`;

			const ws = new WebSocket(wsUrl);
			wsRef.current = ws;

			ws.onopen = () => {
				setIsConnected(true);
				setIsConnecting(false);
				onConnect?.();

				// Clear any pending reconnect
				if (reconnectTimeoutRef.current) {
					clearTimeout(reconnectTimeoutRef.current);
					reconnectTimeoutRef.current = null;
				}
			};

			ws.onmessage = event => {
				try {
					const message = JSON.parse(event.data) as ServerMessage;
					onMessage?.(message);
				} catch (error) {
					console.error('Failed to parse WebSocket message:', error);
				}
			};

			ws.onclose = () => {
				setIsConnected(false);
				setIsConnecting(false);
				onDisconnect?.();

				// Auto-reconnect after 3 seconds
				reconnectTimeoutRef.current = setTimeout(() => {
					connect();
				}, 3000);
			};

			ws.onerror = error => {
				setIsConnecting(false);
				onError?.(error);
			};
		} catch (error) {
			setIsConnecting(false);
			onError?.(error as Event);
		}
	};

	const disconnect = () => {
		if (reconnectTimeoutRef.current) {
			clearTimeout(reconnectTimeoutRef.current);
			reconnectTimeoutRef.current = null;
		}

		if (wsRef.current) {
			wsRef.current.close();
			wsRef.current = null;
		}

		setIsConnected(false);
	};

	const send = (message: ClientMessage) => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify(message));
		}
	};

	// Connect on mount
	useEffect(() => {
		connect();

		return () => {
			disconnect();
		};
	}, [url]);

	return {
		isConnected,
		isConnecting,
		send,
		connect,
		disconnect,
	};
}
