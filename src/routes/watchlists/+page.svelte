<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showCreateForm = $state(false);
	let showAddSymbolForm = $state<string | null>(null);
	let createWatchlistName = $state('');
	let createGroupName = $state('main');
	let addSymbol = $state('');
	let addInstrumentType = $state('Equity');

	function toggleCreateForm() {
		showCreateForm = !showCreateForm;
		if (!showCreateForm) {
			createWatchlistName = '';
			createGroupName = 'main';
		}
	}

	function toggleAddSymbolForm(watchlistName: string | null) {
		showAddSymbolForm = watchlistName;
		if (!watchlistName) {
			addSymbol = '';
			addInstrumentType = 'Equity';
		}
	}

	function formatInstrumentType(type: string | undefined): string {
		if (!type) return 'Equity';
		return type.replace(/([A-Z])/g, ' $1').trim();
	}

	function getQuote(symbol: string, instrumentType: string | undefined) {
		const key = `${symbol}-${instrumentType || 'Equity'}`;
		return data.quotes?.get(key);
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
</script>

<svelte:head>
	<title>Watchlists - Tasty App</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<!-- Header -->
		<div class="mb-8 flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold text-gray-900">Watchlists</h1>
				<div class="mt-2 flex items-center space-x-4">
					{#if data.user}
						<p class="text-gray-600">Manage your trading watchlists</p>
					{/if}
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
			<button
				onclick={toggleCreateForm}
				class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
			>
				{showCreateForm ? 'Cancel' : 'Create Watchlist'}
			</button>
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

		{#if form?.error || data.error}
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
						<p class="text-sm text-red-700">{form?.error || data.error}</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- Create Watchlist Form -->
		{#if showCreateForm}
			<div class="mb-8 rounded-lg bg-white p-6 shadow">
				<h3 class="mb-4 text-lg font-medium text-gray-900">Create New Watchlist</h3>
				<form method="post" action="?/create" use:enhance>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label for="name" class="block text-sm font-medium text-gray-700">Name</label>
							<input
								id="name"
								name="name"
								type="text"
								required
								bind:value={createWatchlistName}
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
								placeholder="Enter watchlist name"
							/>
						</div>
						<div>
							<label for="groupName" class="block text-sm font-medium text-gray-700">Group</label>
							<select
								id="groupName"
								name="groupName"
								bind:value={createGroupName}
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
							onclick={toggleCreateForm}
							class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
						>
							Cancel
						</button>
						<button
							type="submit"
							class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
						>
							Create Watchlist
						</button>
					</div>
				</form>
			</div>
		{/if}

		<!-- Watchlists Grid -->
		{#if data.watchlists && data.watchlists.length > 0}
			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
				{#each data.watchlists as watchlist (watchlist.name)}
					<div class="overflow-hidden rounded-lg bg-white shadow">
						<div class="border-b border-gray-200 px-4 py-4 sm:px-6">
							<div class="flex items-center justify-between">
								<div>
									<a 
										href="/watchlists/{encodeURIComponent(watchlist.name)}"
										class="text-lg font-medium text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
									>
										{watchlist.name}
									</a>
									<p class="text-sm text-gray-500">
										Group: {watchlist['group-name'] || 'main'} •
										{watchlist['watchlist-entries']?.length || 0} symbols
									</p>
								</div>
								<div class="flex space-x-2">
									<button
										onclick={() => toggleAddSymbolForm(watchlist.name)}
										class="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
									>
										Add Symbol
									</button>
									<form method="post" action="?/delete" use:enhance class="inline">
										<input type="hidden" name="name" value={watchlist.name} />
										<button
											type="submit"
											onclick={(e) => {
												if (!confirm(`Are you sure you want to delete "${watchlist.name}"?`)) {
													e.preventDefault();
												}
											}}
											class="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
										>
											Delete
										</button>
									</form>
								</div>
							</div>
						</div>

						<!-- Add Symbol Form -->
						{#if showAddSymbolForm === watchlist.name}
							<div class="border-b border-gray-200 bg-gray-50 px-4 py-3">
								<form method="post" action="?/addSymbol" use:enhance>
									<input type="hidden" name="watchlistName" value={watchlist.name} />
									<div class="flex space-x-2">
										<input
											name="symbol"
											type="text"
											required
											bind:value={addSymbol}
											placeholder="Symbol (e.g., AAPL)"
											class="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
										/>
										<select
											name="instrumentType"
											bind:value={addInstrumentType}
											class="rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
										>
											<option value="Equity">Equity</option>
											<option value="Equity Option">Equity Option</option>
											<option value="Future">Future</option>
											<option value="Future Option">Future Option</option>
											<option value="Cryptocurrency">Cryptocurrency</option>
										</select>
										<button
											type="submit"
											class="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
										>
											Add
										</button>
										<button
											type="button"
											onclick={() => toggleAddSymbolForm(null)}
											class="rounded-md bg-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-400"
										>
											Cancel
										</button>
									</div>
								</form>
							</div>
						{/if}

						<!-- Watchlist Entries -->
						<div class="px-4 py-4 sm:px-6">
							{#if watchlist['watchlist-entries'] && watchlist['watchlist-entries'].length > 0}
								<div class="space-y-3">
									{#each watchlist['watchlist-entries'] as entry (entry.symbol)}
										{@const quote = getQuote(entry.symbol, entry['instrument-type'])}
										{@const priceChange = formatPriceChange(
											quote?.['net-change'],
											quote?.['net-change-percent']
										)}
										<div class="rounded-lg border border-gray-200 bg-white p-3">
											<div class="flex items-start justify-between">
												<div class="flex-1">
													<div class="flex items-center space-x-2">
														<span class="font-semibold text-gray-900">{entry.symbol}</span>
														<span
															class="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600"
														>
															{formatInstrumentType(entry['instrument-type'])}
														</span>
													</div>
													{#if quote}
														<div class="mt-2 grid grid-cols-2 gap-2 text-sm">
															<div>
																<span class="text-gray-500">
																	{data.marketStatus === 'Market Open' ? 'Last:' : 'Close:'}
																</span>
																<span class="ml-1 font-medium">
																	{data.marketStatus === 'Market Open'
																		? formatPrice(quote['last-price'])
																		: formatPrice(quote['close-price'] || quote['last-price'])}
																</span>
															</div>
															<div>
																<span class="text-gray-500">Change:</span>
																<span class="ml-1 font-medium {priceChange.colorClass}"
																	>{priceChange.value}</span
																>
															</div>
															<div>
																<span class="text-gray-500">Bid:</span>
																<span class="ml-1 font-medium">
																	{data.marketStatus === 'Market Open'
																		? formatPrice(quote['bid-price'])
																		: quote['bid-price']
																			? formatPrice(quote['bid-price'])
																			: 'Closed'}
																</span>
															</div>
															<div>
																<span class="text-gray-500">Ask:</span>
																<span class="ml-1 font-medium">
																	{data.marketStatus === 'Market Open'
																		? formatPrice(quote['ask-price'])
																		: quote['ask-price']
																			? formatPrice(quote['ask-price'])
																			: 'Closed'}
																</span>
															</div>
														</div>
														{#if data.marketStatus !== 'Market Open' && quote['last-price'] && quote['close-price'] && quote['last-price'] !== quote['close-price']}
															<div class="mt-2 text-xs text-gray-500">
																Last Trade: {formatPrice(quote['last-price'])}
															</div>
														{/if}
													{:else}
														<div class="mt-2 text-sm text-gray-500">Market data unavailable</div>
													{/if}
												</div>
												<form method="post" action="?/removeSymbol" use:enhance class="ml-3">
													<input type="hidden" name="watchlistName" value={watchlist.name} />
													<input type="hidden" name="symbol" value={entry.symbol} />
													<input
														type="hidden"
														name="instrumentType"
														value={entry['instrument-type']}
													/>
													<button
														type="submit"
														class="rounded p-1 text-red-600 hover:bg-red-50 hover:text-red-800"
														title="Remove symbol"
														aria-label="Remove symbol"
													>
														<svg
															class="h-4 w-4"
															fill="none"
															viewBox="0 0 24 24"
															stroke="currentColor"
														>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																stroke-width="2"
																d="M6 18L18 6M6 6l12 12"
															/>
														</svg>
													</button>
												</form>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<p class="text-center text-sm text-gray-500">No symbols in this watchlist</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="text-center">
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
						d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
					/>
				</svg>
				<h3 class="mt-2 text-sm font-medium text-gray-900">No watchlists</h3>
				<p class="mt-1 text-sm text-gray-500">Get started by creating your first watchlist.</p>
				<div class="mt-6">
					<button
						onclick={toggleCreateForm}
						class="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
					>
						<svg class="mr-2 -ml-1 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
								clip-rule="evenodd"
							/>
						</svg>
						Create Watchlist
					</button>
				</div>
			</div>
		{/if}

		<!-- Navigation -->
		<div class="mt-8 flex justify-center">
			<a
				href="/dashboard"
				class="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none"
			>
				Back to Dashboard
			</a>
		</div>
	</div>
</div>
