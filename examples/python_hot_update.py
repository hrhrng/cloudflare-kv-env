from cfenv_sdk import CfenvClient


def main():
    client = CfenvClient(
        account_id="YOUR_ACCOUNT_ID",
        api_token="YOUR_API_TOKEN",
        namespace_id="YOUR_NAMESPACE_ID",
        project="playheads",
        environment="production",
    )

    def on_update(snapshot, reason):
        print("hot update:", reason, snapshot.metadata.updated_at, snapshot.metadata.entries_count)
        client.apply_to_process_env(overwrite=True)

    def on_error(error):
        print("hot update error:", error)

    watcher = client.create_hot_updater(
        on_update=on_update,
        on_error=on_error,
        interval_seconds=30,
        max_interval_seconds=300,
        bootstrap=True,
    )
    watcher.start()

    try:
        # keep process alive
        import time
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        watcher.stop(timeout=2)


if __name__ == "__main__":
    main()
