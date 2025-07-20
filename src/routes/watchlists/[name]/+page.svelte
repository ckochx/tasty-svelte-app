<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount, onDestroy } from 'svelte';
	import { streamingStore, connectionStatus } from '$lib/stores/streaming';
	import type { Quote } from '$lib/server/market-data';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showEditForm = $state(false);
	let showAddSymbolForm = $state(false);
	let editName = $state(data.watchlist.name);
	let editGroupName = $state(data.watchlist['group-name'] || 'main');
	let addSymbol = $state('');
	let addInstrumentType = $state('Equity');

	// Streaming state
	let streamingMode = $state(false);
	let pollingInterval: ReturnType<typeof setInterval> | undefined;

	// Local quotes state for client-side updates
	let localQuotes = $state(data.quotes);

	// Reactive quotes - merge polling and streaming data - access store reactively
	let mergedQuotes = $derived.by(() => {
		// This will be reactive to streamingStore changes
		return streamingStore.mergeQuotes(localQuotes);
	});

	function toggleEditForm() {
		showEditForm = !showEditForm;
		if (showEditForm) {
			editName = data.watchlist.name;
			editGroupName = data.watchlist['group-name'] || 'main';
		}
	}

	function toggleAddSymbolForm() {
		showAddSymbolForm = !showAddSymbolForm;
		if (!showAddSymbolForm) {
			addSymbol = '';
			addInstrumentType = 'Equity';
		}
	}

	function formatInstrumentType(type: string | undefined): string {
		if (!type) return 'Equity';
		return type.replace(/([A-Z])/g, ' $1').trim();
	}

	function getInstrumentTypeIcon(type: string | undefined): string {
		switch (type) {
			case 'Equity':
				return '📈';
			case 'Equity Option':
				return '⚡';
			case 'Future':
				return '🔮';
			case 'Future Option':
				return '🎯';
			case 'Cryptocurrency':
				return '₿';
			default:
				return '📊';
		}
	}

	function getQuote(symbol: string, instrumentType: string | undefined) {
		const key = `${symbol}-${instrumentType || 'Equity'}`;
		const quote = mergedQuotes?.get(key);
		return quote;
	}

	function formatPrice(price: number | undefined): string {
		if (price === undefined || price === null) {
			return '--';
		}
		return `$${price.toFixed(2)}`;
	}

	function formatPriceChange(
		change: number | undefined,
		changePercent: number | undefined
	): {
		value: string;
		colorClass: string;
	} {
		if (change === undefined || change === null) {
			return { value: '--', colorClass: 'text-gray-500' };
		}

		const formattedChange = change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2);
		const formattedPercent =
			changePercent !== undefined
				? ` (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)`
				: '';

		return {
			value: `${formattedChange}${formattedPercent}`,
			colorClass: change >= 0 ? 'text-green-600' : 'text-red-600'
		};
	}

	async function toggleStreamingMode() {
		console.log('Toggle streaming mode clicked, current mode:', streamingMode);

		if (streamingMode) {
			// Switch to polling mode
			console.log('Switching to polling mode');
			streamingMode = false;
			streamingStore.setMode('polling');
			streamingStore.disconnect();
			startPolling();
		} else {
			// Switch to streaming mode
			console.log('Switching to streaming mode');
			stopPolling();
			streamingMode = true;
			streamingStore.setMode('streaming');

			console.log('Attempting to connect to streaming...');
			const connected = await streamingStore.connect();
			console.log('Streaming connection result:', connected);

			if (connected) {
				// Subscribe to all symbols in the watchlist
				const symbols = (data.watchlist['watchlist-entries'] || []).map((entry) => entry.symbol);
				console.log('Subscribing to symbols:', symbols);
				streamingStore.subscribeToSymbols(symbols);
			} else {
				// Fall back to polling if streaming fails
				console.log('Streaming failed, falling back to polling');
				streamingMode = false;
				streamingStore.setMode('polling');
				startPolling();
			}
		}
	}

	async function fetchQuotesClient() {
		try {
			const symbols = (data.watchlist['watchlist-entries'] || []).map((entry) => entry.symbol);
			if (symbols.length === 0) return;

			// Fetch quotes using client-side API call
			const response = await fetch('/api/quotes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					symbols: symbols.map((s) => ({ symbol: s, instrumentType: 'Equity' }))
				})
			});

			if (response.ok) {
				const result = await response.json();
				// Update the local quotes state reactively without page reload
				if (result.quotes) {
					localQuotes = new Map(
						result.quotes.map((q: Quote) => [`${q.symbol}-${q['instrument-type']}`, q])
					);
				}
			}
		} catch (error) {
			console.error('Failed to fetch quotes:', error);
		}
	}

	function startPolling() {
		stopPolling();
		// Refresh data every 30 seconds in polling mode
		pollingInterval = setInterval(async () => {
			await fetchQuotesClient();
		}, 30000);
	}

	function stopPolling() {
		if (pollingInterval) {
			clearInterval(pollingInterval);
			pollingInterval = undefined;
		}
	}

	onMount(() => {
		streamingStore.init();
		// Start with polling mode
		startPolling();
	});

	onDestroy(() => {
		stopPolling();
		streamingStore.disconnect();
	});
</script>

<svelte:head>
	<title>{data.watchlist.name} - Watchlists - Tasty App</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
		<!-- Header -->
		<div class="mb-8">
			<nav class="flex" aria-label="Breadcrumb">
				<ol class="flex items-center space-x-4">
					<li>
						<a href="/dashboard" class="text-gray-400 hover:text-gray-500">Dashboard</a>
					</li>
					<li>
						<svg
							class="h-5 w-5 flex-shrink-0 text-gray-300"
							fill="currentColor"
							viewBox="0 0 20 20"
						>
							<path
								fill-rule="evenodd"
								d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
								clip-rule="evenodd"
							/>
						</svg>
					</li>
					<li>
						<a href="/watchlists" class="text-gray-400 hover:text-gray-500">Watchlists</a>
					</li>
					<li>
						<svg
							class="h-5 w-5 flex-shrink-0 text-gray-300"
							fill="currentColor"
							viewBox="0 0 20 20"
						>
							<path
								fill-rule="evenodd"
								d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
								clip-rule="evenodd"
							/>
						</svg>
					</li>
					<li>
						<span class="text-gray-500">{data.watchlist.name}</span>
					</li>
				</ol>
			</nav>

			<div class="mt-4 flex items-center justify-between">
				<div>
					<h1 class="text-3xl font-bold text-gray-900">{data.watchlist.name}</h1>
					<div class="mt-2 flex items-center space-x-4">
						<p class="text-gray-600">
							Group: {data.watchlist['group-name'] || 'main'} •
							{data.watchlist['watchlist-entries']?.length || 0} symbols
						</p>
						{#if data.marketStatus}
							<span
								class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {data.marketStatus ===
								'Market Open'
									? 'bg-green-100 text-green-800'
									: 'bg-gray-100 text-gray-800'}"
							>
								<span
									class="mr-1 h-1.5 w-1.5 rounded-full {data.marketStatus === 'Market Open'
										? 'bg-green-400'
										: 'bg-gray-400'}"
								></span>
								{data.marketStatus}
							</span>
						{/if}
					</div>
				</div>
				<div class="flex items-center space-x-4">
					<!-- Connection Status -->
					{#if $connectionStatus.error}
						<div class="text-sm text-red-600">
							Error: {$connectionStatus.error}
						</div>
					{:else if streamingMode && $connectionStatus.connected}
						<div class="flex items-center text-sm text-green-600">
							<div class="mr-2 h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
							Streaming Live
						</div>
					{:else if streamingMode}
						<div class="flex items-center text-sm text-yellow-600">
							<div class="mr-2 h-2 w-2 rounded-full bg-yellow-500"></div>
							Connecting...
						</div>
					{:else}
						<div class="flex items-center text-sm text-gray-600">
							<div class="mr-2 h-2 w-2 rounded-full bg-gray-400"></div>
							Polling (30s)
						</div>
					{/if}

					<!-- Toggle Button -->
					<div class="flex items-center space-x-2">
						<button
							type="button"
							onclick={toggleStreamingMode}
							class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 focus:outline-none {streamingMode
								? 'bg-indigo-600'
								: 'bg-gray-200'}"
							role="switch"
							aria-checked={streamingMode}
							aria-labelledby="streaming-toggle-label"
						>
							<span
								aria-hidden="true"
								class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {streamingMode
									? 'translate-x-5'
									: 'translate-x-0'}"
							></span>
						</button>
						<span class="text-sm font-medium text-gray-700" id="streaming-toggle-label">
							Streaming
						</span>
					</div>

					<div class="flex space-x-3">
						<button
							onclick={toggleAddSymbolForm}
							class="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none"
						>
							{showAddSymbolForm ? 'Cancel' : 'Add Symbol'}
						</button>
						<button
							onclick={toggleEditForm}
							class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
						>
							{showEditForm ? 'Cancel' : 'Edit Watchlist'}
						</button>
						<form method="post" action="?/delete" use:enhance class="inline">
							<button
								type="submit"
								onclick={(e) => {
									if (!confirm(`Are you sure you want to delete "${data.watchlist.name}"?`)) {
										e.preventDefault();
									}
								}}
								class="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
							>
								Delete Watchlist
							</button>
						</form>
					</div>

					<div class="flex-shrink-0">
						<img src="/favicon.png" alt="Tasty App" class="h-12 w-12" />
					</div>
				</div>
			</div>
		</div>

		<!-- Success/Error Messages -->
		{#if form?.success}
			<div class="mb-6 rounded-md border border-green-200 bg-green-50 p-4">
				<div class="flex">
					<div class="flex-shrink-0">
						<svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
								clip-rule="evenodd"
							/>
						</svg>
					</div>
					<div class="ml-3">
						<p class="text-sm text-green-700">{form.message}</p>
					</div>
				</div>
			</div>
		{/if}

		{#if form?.error}
			<div class="mb-6 rounded-md border border-red-200 bg-red-50 p-4">
				<div class="flex">
					<div class="flex-shrink-0">
						<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
								clip-rule="evenodd"
							/>
						</svg>
					</div>
					<div class="ml-3">
						<p class="text-sm text-red-700">{form.error}</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- Edit Watchlist Form -->
		{#if showEditForm}
			<div class="mb-8 rounded-lg bg-white p-6 shadow">
				<h3 class="mb-4 text-lg font-medium text-gray-900">Edit Watchlist</h3>
				<form method="post" action="?/update" use:enhance>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label for="name" class="block text-sm font-medium text-gray-700">Name</label>
							<input
								id="name"
								name="name"
								type="text"
								required
								bind:value={editName}
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
							/>
						</div>
						<div>
							<label for="groupName" class="block text-sm font-medium text-gray-700">Group</label>
							<select
								id="groupName"
								name="groupName"
								bind:value={editGroupName}
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
							>
								<option value="main">Main</option>
								<option value="options">Options</option>
								<option value="crypto">Crypto</option>
								<option value="futures">Futures</option>
							</select>
						</div>
					</div>
					<div class="mt-4 flex justify-end space-x-3">
						<button
							type="button"
							onclick={toggleEditForm}
							class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
						>
							Cancel
						</button>
						<button
							type="submit"
							class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
						>
							Update Watchlist
						</button>
					</div>
				</form>
			</div>
		{/if}

		<!-- Add Symbol Form -->
		{#if showAddSymbolForm}
			<div class="mb-8 rounded-lg bg-white p-6 shadow">
				<h3 class="mb-4 text-lg font-medium text-gray-900">Add Symbol</h3>
				<form method="post" action="?/addSymbol" use:enhance>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label for="symbol" class="block text-sm font-medium text-gray-700">Symbol</label>
							<input
								id="symbol"
								name="symbol"
								type="text"
								required
								bind:value={addSymbol}
								placeholder="e.g., AAPL, SPY, etc."
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
							/>
						</div>
						<div>
							<label for="instrumentType" class="block text-sm font-medium text-gray-700">
								Instrument Type
							</label>
							<select
								id="instrumentType"
								name="instrumentType"
								bind:value={addInstrumentType}
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
							>
								<option value="Equity">Equity</option>
								<option value="Equity Option">Equity Option</option>
								<option value="Future">Future</option>
								<option value="Future Option">Future Option</option>
								<option value="Cryptocurrency">Cryptocurrency</option>
							</select>
						</div>
					</div>
					<div class="mt-4 flex justify-end space-x-3">
						<button
							type="button"
							onclick={toggleAddSymbolForm}
							class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
						>
							Cancel
						</button>
						<button
							type="submit"
							class="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none"
						>
							Add Symbol
						</button>
					</div>
				</form>
			</div>
		{/if}

		<!-- Watchlist Entries -->
		<div class="rounded-lg bg-white shadow">
			<div class="border-b border-gray-200 px-4 py-5 sm:px-6">
				<h3 class="text-lg font-medium text-gray-900">Symbols</h3>
				<p class="mt-1 text-sm text-gray-500">
					{data.watchlist['watchlist-entries']?.length || 0} symbols in this watchlist
				</p>
			</div>

			{#if data.watchlist['watchlist-entries'] && data.watchlist['watchlist-entries'].length > 0}
				<!-- Table Header -->
				<div class="border-b border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
					<div
						class="grid grid-cols-6 gap-4 text-left text-xs font-medium tracking-wide text-gray-500 uppercase"
					>
						<div class="col-span-2">Symbol</div>
						<div>{data.marketStatus === 'Market Open' ? 'Last Price' : 'Close Price'}</div>
						<div>Bid</div>
						<div>Ask</div>
						<div>Change</div>
					</div>
				</div>

				<!-- Table Body -->
				<div class="divide-y divide-gray-200">
					{#each data.watchlist['watchlist-entries'] as entry (entry.symbol + entry['instrument-type'])}
						{@const quote = getQuote(entry.symbol, entry['instrument-type'])}
						{@const priceChange = formatPriceChange(
							quote?.['net-change'],
							quote?.['net-change-percent']
						)}
						<div class="px-4 py-4 hover:bg-gray-50 sm:px-6">
							<div class="grid grid-cols-6 items-center gap-4">
								<!-- Symbol & Type -->
								<div class="col-span-2 flex items-center">
									<div class="mr-3 text-lg">{getInstrumentTypeIcon(entry['instrument-type'])}</div>
									<div>
										<div class="flex items-center">
											<span class="text-lg font-semibold text-gray-900">{entry.symbol}</span>
											<span
												class="ml-2 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600"
											>
												{formatInstrumentType(entry['instrument-type'])}
											</span>
										</div>
										{#if entry['order-index'] !== undefined}
											<p class="text-xs text-gray-500">Position: {entry['order-index'] + 1}</p>
										{/if}
									</div>
								</div>

								<!-- Last Price / Close Price -->
								<div class="text-lg font-semibold text-gray-900">
									{data.marketStatus === 'Market Open'
										? formatPrice(quote?.['last-price'])
										: formatPrice(quote?.['close-price'] || quote?.['last-price'])}
								</div>

								<!-- Bid -->
								<div class="text-sm">
									<div class="font-medium text-gray-900">
										{#if data.marketStatus === 'Market Open' || quote?.['bid-price']}
											{formatPrice(quote?.['bid-price'])}
										{:else}
											<span class="text-gray-500">Closed</span>
										{/if}
									</div>
									{#if quote?.['bid-size'] && (data.marketStatus === 'Market Open' || quote?.['bid-price'])}
										<div class="text-xs text-gray-500">Size: {quote['bid-size']}</div>
									{/if}
								</div>

								<!-- Ask -->
								<div class="text-sm">
									<div class="font-medium text-gray-900">
										{#if data.marketStatus === 'Market Open' || quote?.['ask-price']}
											{formatPrice(quote?.['ask-price'])}
										{:else}
											<span class="text-gray-500">Closed</span>
										{/if}
									</div>
									{#if quote?.['ask-size'] && (data.marketStatus === 'Market Open' || quote?.['ask-price'])}
										<div class="text-xs text-gray-500">Size: {quote['ask-size']}</div>
									{/if}
								</div>

								<!-- Change -->
								<div class="flex items-center justify-between">
									<div class="text-sm font-medium {priceChange.colorClass}">
										{priceChange.value}
									</div>
									<form method="post" action="?/removeSymbol" use:enhance>
										<input type="hidden" name="symbol" value={entry.symbol} />
										<input type="hidden" name="instrumentType" value={entry['instrument-type']} />
										<button
											type="submit"
											onclick={(e) => {
												if (!confirm(`Remove ${entry.symbol} from watchlist?`)) {
													e.preventDefault();
												}
											}}
											class="rounded-md p-1 text-red-600 hover:bg-red-50 hover:text-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
											title="Remove symbol"
											aria-label="Remove symbol from watchlist"
										>
											<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
												/>
											</svg>
										</button>
									</form>
								</div>
							</div>

							<!-- Additional market data on mobile -->
							<div class="mt-3 sm:hidden">
								{#if quote}
									<div class="grid grid-cols-2 gap-2 text-sm">
										<div>
											<span class="text-gray-500">Day High:</span>
											<span class="ml-1 font-medium">{formatPrice(quote['day-high'])}</span>
										</div>
										<div>
											<span class="text-gray-500">Day Low:</span>
											<span class="ml-1 font-medium">{formatPrice(quote['day-low'])}</span>
										</div>
										<div>
											<span class="text-gray-500">Volume:</span>
											<span class="ml-1 font-medium">{quote.volume?.toLocaleString() || '--'}</span>
										</div>
										<div>
											<span class="text-gray-500">
												{data.marketStatus === 'Market Open' ? 'Open:' : 'Prev Close:'}
											</span>
											<span class="ml-1 font-medium">
												{formatPrice(
													data.marketStatus === 'Market Open'
														? quote['open-price']
														: quote['close-price']
												)}
											</span>
										</div>
									</div>
									{#if data.marketStatus !== 'Market Open'}
										<div class="mt-2 text-xs text-gray-500 italic">
											Market closed - showing last available data
										</div>
										{#if quote['last-price'] && quote['close-price'] && quote['last-price'] !== quote['close-price']}
											<div class="mt-1 text-xs text-gray-500">
												Last Trade: {formatPrice(quote['last-price'])}
											</div>
										{/if}
									{/if}
								{:else}
									<div class="text-sm text-gray-500">Market data unavailable</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="px-4 py-12 text-center sm:px-6">
					<svg
						class="mx-auto h-12 w-12 text-gray-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
						/>
					</svg>
					<h3 class="mt-2 text-sm font-medium text-gray-900">No symbols</h3>
					<p class="mt-1 text-sm text-gray-500">
						Get started by adding your first symbol to this watchlist.
					</p>
					<div class="mt-6">
						<button
							onclick={toggleAddSymbolForm}
							class="inline-flex items-center rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none"
						>
							<svg class="mr-2 -ml-1 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
									clip-rule="evenodd"
								/>
							</svg>
							Add Symbol
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
