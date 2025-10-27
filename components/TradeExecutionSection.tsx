import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { io } from "socket.io-client";
import type { Signal, LivePosition, ToastMessage } from '../types';
import { AutomationSetupModal } from './AutomationSetupModal';
import { PositionsTable } from './PositionsTable';
import { TradeQueueTable } from './TradeQueueTable';
import { AnalyticsChart } from './AnalyticsChart';
import { metaApi } from '../lib/metaApi';
import { InformationCircleIcon } from './icons';

interface TradeExecutionSectionProps {
    signals: Signal[];
    addToast: (message: string, type?: ToastMessage['type']) => void;
}

type AutomationStatus = 'manual' | 'auto' | 'paused';

// NOTE: In a real deployment, this URL should come from an environment variable.
const BACKEND_URL = 'http://localhost:3001';

export const TradeExecutionSection: React.FC<TradeExecutionSectionProps> = ({ signals, addToast }) => {
    const [automationStatus, setAutomationStatus] = useState<AutomationStatus>('manual');
    const [riskSettings, setRiskSettings] = useState({ maxPositions: 5, volumeCap: 0.1 });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSetupComplete, setIsSetupComplete] = useState(false);
    const [pendingSignals, setPendingSignals] = useState<Signal[]>([]);
    const [livePositions, setLivePositions] = useState<LivePosition[]>([]);
    const [loadingPositions, setLoadingPositions] = useState(true);
    const [executedSignalIds, setExecutedSignalIds] = useState<Set<string>>(new Set());

    const fetchPositions = useCallback(async () => {
        setLoadingPositions(true);
        try {
            const positions = await metaApi.getPositions();
            setLivePositions(positions);
        } catch (error) {
            console.error("Failed to fetch positions", error);
            addToast("Failed to fetch live positions from backend.", "error");
        } finally {
            setLoadingPositions(false);
        }
    }, [addToast]);
    
    // Initial fetch and WebSocket connection setup
    useEffect(() => {
        fetchPositions(); // Initial fetch via REST

        const socket = io(BACKEND_URL);

        socket.on('connect', () => {
            console.log('Connected to backend WebSocket.');
        });
        
        // Listen for real-time position updates
        socket.on('positions_update', (positions: LivePosition[]) => {
            setLivePositions(positions);
            setLoadingPositions(false);
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from backend WebSocket.');
        });

        return () => {
            socket.disconnect();
        };
    }, [fetchPositions]);

    const isRiskOk = useCallback((signal: Signal): boolean => {
        if (livePositions.length >= riskSettings.maxPositions) {
            addToast(`Risk Skip: Max open positions (${riskSettings.maxPositions}) reached.`, 'info');
            return false;
        }
        return true;
    }, [livePositions.length, riskSettings.maxPositions, addToast]);

    const handleExecuteSignal = useCallback(async (signal: Signal) => {
        if (!isRiskOk(signal)) {
            setPendingSignals(prev => prev.filter(s => s.signal_id !== signal.signal_id));
            addToast(`Signal ${signal.symbol} skipped due to risk violation.`, 'info');
            return;
        }
        
        try {
            const result = await metaApi.executeTrade(signal);
            if (result.success) {
                addToast(`Trade Executed: ${signal.side.toUpperCase()} ${signal.symbol}`, 'success');
                setExecutedSignalIds(prev => new Set(prev).add(signal.signal_id));
                setPendingSignals(prev => prev.filter(s => s.signal_id !== signal.signal_id));
                // Positions will update automatically via WebSocket
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            addToast(`Execution Failed: ${error.message}`, 'error');
        }
    }, [addToast, isRiskOk]);

    useEffect(() => {
        // Find new signals that are not yet pending or executed
        const newSignals = signals.filter(s => 
            !pendingSignals.some(ps => ps.signal_id === s.signal_id) &&
            !executedSignalIds.has(s.signal_id)
        );
        
        if (newSignals.length > 0) {
            setPendingSignals(prev => [...newSignals, ...prev].slice(0, 10)); // Add new signals to the front, keep last 10
            
            if (automationStatus === 'auto') {
                for (const signal of newSignals) {
                    handleExecuteSignal(signal);
                }
            }
        }
    }, [signals, automationStatus, pendingSignals, executedSignalIds, handleExecuteSignal]);

    const handleClosePosition = async (positionId: string) => {
        try {
            const result = await metaApi.closePosition(positionId);
            if (result.success) {
                addToast("Position closed successfully.", "success");
                // Position list will update via WebSocket
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            addToast(`Failed to close position: ${error.message}`, "error");
        }
    };
    
    const pnlHistory = useMemo(() => {
        let cumulativePnl = 0;
        // The backend only sends open positions, so PnL chart is not applicable in this live model
        // We'll leave the component here for potential future use with historical trade data.
        return [];
    }, []);


    const handleStatusChange = (status: AutomationStatus) => {
        if(status === 'auto' && !isSetupComplete) {
            addToast('Please complete the risk setup first.', 'info');
            setIsModalOpen(true);
            return;
        }
        setAutomationStatus(status);
        addToast(`Automation mode set to: ${status.toUpperCase()}`, 'info');
    };

    return (
        <div className="p-4 space-y-6">
            <AutomationSetupModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={(settings) => {
                    setRiskSettings(settings);
                    setIsModalOpen(false);
                    setIsSetupComplete(true);
                    setAutomationStatus('auto');
                     addToast('Risk settings saved. Automation is now ACTIVE.', 'success');
                }}
                currentSettings={riskSettings}
            />

            <div>
                <div className="flex justify-between items-center">
                    <h3 className="text-md font-semibold text-text-primary">Automation Control</h3>
                     <button onClick={() => setIsModalOpen(true)} className="text-xs text-accent hover:underline">
                        Risk Setup
                    </button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1 bg-bg-primary/50 p-1 rounded-lg border border-border">
                    {(['manual', 'auto', 'paused'] as AutomationStatus[]).map(status => (
                        <button
                            key={status}
                            onClick={() => handleStatusChange(status)}
                            className={`px-2 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                                automationStatus === status 
                                ? (status === 'auto' ? 'auto-trade-active text-white shadow' : 'bg-accent text-white shadow')
                                : 'text-text-secondary hover:bg-border'
                            }`}
                        >
                            {status.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-40">
                 <h3 className="text-md font-semibold text-text-primary mb-2">Session P&L</h3>
                {pnlHistory.length > 1 ? (
                    <AnalyticsChart data={pnlHistory} />
                ) : (
                    <div className="flex items-center justify-center h-full text-text-muted text-sm bg-bg-primary/50 rounded-lg border border-border">
                        <InformationCircleIcon className="w-5 h-5 mr-2"/>
                        Live P&L updates in the table below.
                    </div>
                )}
            </div>

            <div>
                <h3 className="text-md font-semibold text-text-primary mb-2">Trade Queue ({pendingSignals.length})</h3>
                <TradeQueueTable signals={pendingSignals} onExecute={handleExecuteSignal} disabled={automationStatus !== 'manual'} />
            </div>

            <div>
                 <h3 className="text-md font-semibold text-text-primary mb-2">Live Positions ({livePositions.length})</h3>
                 <PositionsTable positions={livePositions} onClose={handleClosePosition} loading={loadingPositions} />
            </div>
        </div>
    );
};