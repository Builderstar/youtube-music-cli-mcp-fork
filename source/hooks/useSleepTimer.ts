// Hook for managing the sleep timer
import {useState, useEffect, useCallback} from 'react';
import {
	getSleepTimerService,
	SLEEP_TIMER_PRESETS,
	type SleepTimerPreset,
} from '../services/sleep-timer/sleep-timer.service.ts';
import {usePlayer} from './usePlayer.ts';

export function useSleepTimer() {
	const {pause} = usePlayer();
	const timerService = getSleepTimerService();
	const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
	const [activeMinutes, setActiveMinutes] = useState<number | null>(null);

	// Poll remaining time every second when active
	useEffect(() => {
		if (!timerService.isActive()) return;

		const interval = setInterval(() => {
			const remaining = timerService.getRemainingSeconds();
			setRemainingSeconds(remaining);
			if (remaining === 0) {
				setActiveMinutes(null);
				clearInterval(interval);
			}
		}, 1000);

		return () => {
			clearInterval(interval);
		};
	}, [activeMinutes, timerService]);

	const startTimer = useCallback(
		(minutes: SleepTimerPreset) => {
			setActiveMinutes(minutes);
			setRemainingSeconds(minutes * 60);
			timerService.start(minutes, () => {
				pause();
				setActiveMinutes(null);
				setRemainingSeconds(null);
			});
		},
		[timerService, pause],
	);

	const cancelTimer = useCallback(() => {
		timerService.cancel();
		setActiveMinutes(null);
		setRemainingSeconds(null);
	}, [timerService]);

	return {
		isActive: timerService.isActive(),
		activeMinutes,
		remainingSeconds,
		startTimer,
		cancelTimer,
		presets: SLEEP_TIMER_PRESETS,
	};
}
