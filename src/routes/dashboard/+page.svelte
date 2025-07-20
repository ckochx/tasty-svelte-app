<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Dashboard - Tasty App</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="mb-8 flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold text-gray-900">Dashboard</h1>
				{#if data.user}
					<p class="mt-2 text-gray-600">Welcome back, {data.user.username}!</p>
				{/if}
			</div>
			<div class="flex-shrink-0">
				<img src="/favicon.png" alt="Tasty App" class="h-12 w-12" />
			</div>
		</div>

		{#if data.error}
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
						<h3 class="text-sm font-medium text-red-800">Error</h3>
						<p class="mt-1 text-sm text-red-700">{data.error}</p>
					</div>
				</div>
			</div>
		{/if}

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<!-- User Info Card -->
			<div class="overflow-hidden rounded-lg bg-white shadow">
				<div class="px-4 py-5 sm:p-6">
					<h3 class="mb-4 text-lg leading-6 font-medium text-gray-900">Account Information</h3>
					{#if data.user}
						<dl class="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
							<div>
								<dt class="text-sm font-medium text-gray-500">Username</dt>
								<dd class="text-sm text-gray-900">{data.user.username}</dd>
							</div>
							<div>
								<dt class="text-sm font-medium text-gray-500">Email</dt>
								<dd class="text-sm text-gray-900">{data.user.email}</dd>
							</div>
							<div>
								<dt class="text-sm font-medium text-gray-500">External ID</dt>
								<dd class="text-sm text-gray-900">{data.user['external-id']}</dd>
							</div>
						</dl>
					{:else}
						<p class="text-gray-500">User information not available</p>
					{/if}
				</div>
			</div>

			<!-- Accounts Card -->
			<div class="overflow-hidden rounded-lg bg-white shadow">
				<div class="px-4 py-5 sm:p-6">
					<h3 class="mb-4 text-lg leading-6 font-medium text-gray-900">Trading Accounts</h3>
					{#if data.accounts && data.accounts.length > 0}
						<div class="space-y-3">
							{#each data.accounts as account (account['account-number'] || account.id)}
								<div class="rounded-lg border border-gray-200 p-3">
									<div class="flex items-start justify-between">
										<div>
											<p class="text-sm font-medium text-gray-900">
												{account['account-number'] || 'Account'}
											</p>
											<p class="text-sm text-gray-500">
												{account.nickname || 'Trading Account'}
											</p>
										</div>
										<span
											class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800"
										>
											{account.status || 'Active'}
										</span>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-gray-500">No trading accounts found</p>
					{/if}
				</div>
			</div>
		</div>

		<!-- Quick Actions -->
		<div class="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<a
				href="/watchlists"
				class="rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-md"
			>
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<svg
							class="h-8 w-8 text-indigo-600"
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
					</div>
					<div class="ml-4">
						<h3 class="text-lg font-medium text-gray-900">Watchlists</h3>
						<p class="text-sm text-gray-600">Manage your trading watchlists</p>
					</div>
				</div>
			</a>

			<div class="rounded-lg bg-white p-6 shadow">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<svg
							class="h-8 w-8 text-green-600"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
							/>
						</svg>
					</div>
					<div class="ml-4">
						<h3 class="text-lg font-medium text-gray-900">Market Data</h3>
						<p class="text-sm text-gray-600">View real-time market data</p>
					</div>
				</div>
			</div>

			<div class="rounded-lg bg-white p-6 shadow">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<svg
							class="h-8 w-8 text-yellow-600"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
							/>
						</svg>
					</div>
					<div class="ml-4">
						<h3 class="text-lg font-medium text-gray-900">Trading</h3>
						<p class="text-sm text-gray-600">Place and manage orders</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Actions -->
		<div class="mt-8">
			<form method="post" action="/logout" class="inline">
				<button
					type="submit"
					class="rounded-md bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700"
				>
					Logout
				</button>
			</form>
		</div>
	</div>
</div>
