/**
 * Message event used in {@link MessageData.event}.
 * @readonly
 * - {@link Typing} - Indicates a user has started typing.
 * - {@link StopTyping} - Indicates a user has stopped typing without sending.
 * - {@link Edit} - Indicates a user has edited the message with ID {@link MessageData.id}.
 * - {@link Delivered} - Indicates a message has been recieved.
 * - {@link RSAKeyShare} - Indicates an RSA public key is being sent unencrypted.
 * - {@link AESKeyShare} - Indicates an AES key is being sent encrypted with the previously sent RSA public key.
 * @enum {number}
 */
enum MessageDataEvent {
	/**
	 * Indicates a user has started typing.
	 * @name MessageDataEvent.Typing
	 */
	Typing,
	/**
	 * Indicates a user has stopped typing without sending.
	 * @name MessageDataEvent.StopTyping
	 */
	StopTyping,
	/**
	 * Indicates a user has edited the message with ID {@link MessageData.id}.
	 * @name MessageDataEvent.Edit
	 */
	Edit,
	/**
	 * Indicates a message has been recieved.
	 * @name MessageDataEvent.Delivered
	 */
	Delivered,
	/**
	 * Indicates an RSA public key is being sent unencrypted.
	 * @name MessageDataEvent.RSAKeyShare
	 */
	RSAKeyShare,
	/**
	 * Indicates an AES key is being sent encrypted with the previously sent RSA public key.
	 * @name MessageDataEvent.AESKeyShare
	 */
	AESKeyShare,
};

/**
 * Message effect used in {@link MessageData.effect}.
 * @readonly
 * @enum {number}
 */
enum MessageDataEffects {};

/**
 * A message to be sent to a peer.
 * @property {string} from - The sender of the current {@link MessageData} object.
 * @property {string} body - The message being sent.
 * @property {string} time - The locale string representation of the time the message is being sent at.
 * @property {string} id - The message ID.
 * @property {MessageDataEvent=} event - Special event for a message.
 * @property {string=} prev - Message being replied to.
 * @property {MessageDataEffects=} effect - Message effect being applied.
 * @interface
 */
interface MessageData {
	/**
	 * The sender of the current {@link MessageData} object.
	 * @type {string}
	 * @name MessageData.from
	 */
	from: string,
	/**
	 * The message being sent.
	 * @type {string}
	 * @name MessageData.body
	 */
	body: string,
	/**
	 * The locale string representation of the time the message is being sent at.
	 * @type {string}
	 * @name MessageData.time
	 */
	time: string,
	/**
	 * The message ID.
	 * @type {string}
	 * @name MessageData.id
	 */
	id: string,
	/**
	 * Special event for a message.
	 * @type {MessageDataEvent?}
	 * @name MessageData.event
	 */
	event?: MessageDataEvent,
	/**
	 * Message being replied to.
	 * @type {string?}
	 * @name MessageData.prev
	 */
	prev?: string,
	/**
	 * Message effect being applied.
	 * @type {MessageDataEffects?}
	 * @name MessageData.effect
	 */
	effect?: MessageDataEffects,
};

/**
 * Message ID of the message being edited.
 * @type {string?}
 */
var editing: string | undefined = undefined;

/**
 * Message ID of the message being edited.
 * @type {string?}
 */
var replying: string | undefined = undefined;

/**
 * RSA public and private key pair.
 * @type {Promise<CryptoKeyPair>}
 */
var keyPair: Promise<CryptoKeyPair> = crypto.subtle.generateKey(
	{
		name: 'RSA-OAEP',
		modulusLength: 4096,
		publicExponent: new Uint8Array([1, 0, 1]),
		hash: 'SHA-256',
	},
	true,
	['encrypt', 'decrypt'],
);

/**
 * AES keys for the active conversations.
 * @type { { [string]: [Uint8Array, CryptoKey] } }
 */
var aesKeys: { [id: string]: [Uint8Array, CryptoKey] } = {};

/**
 * Exports an RSA `CryptoKey` into a `Promise<string>` that resolves to a `string` representation.
 * @param {CryptoKey} key - RSA `CryptoKey` to convert to a `string`.
 * @returns {Promise<string>} `Promise<string>` that resolves to the `string` representation of an RSA `CryptoKey`.
 */
const exportRSAKey = async (key: CryptoKey): Promise<string> => `-----BEGIN PUBLIC KEY-----\n${window.btoa(String.fromCharCode.apply(null, new Uint8Array(await window.crypto.subtle.exportKey("spki", key)) as unknown as Array<number>))}\n-----END PUBLIC KEY-----`;

/**
 * Converts a `string` into an `ArrayBuffer`.
 * @param {string} str - `string` to convert to an `ArrayBuffer`.
 * @returns {ArrayBuffer} `ArrayBuffer` representation of the provded `string`.
 */
const str2ab = (str: string): ArrayBuffer => {
	const buf: ArrayBuffer = new ArrayBuffer(str.length);
	const bufView: Uint8Array = new Uint8Array(buf);
	for (let i: number = 0, strLen = str.length; i < strLen; i++) {
		bufView[i] = str.charCodeAt(i);
	}
	return buf;
}

/**
 * Imports an RSA `CryptoKey` into a `Promise<CryptoKey>` from a `string` that resolves to the RSA `CryptoKey`.
 * @param {string} pem - `string` to convert to an RSA `CryptoKey`.
 * @returns {Promise<CryptoKey>} `Promise<CryptoKey>` that resolves to the RSA `CryptoKey` from the `string` representation.
 */
const importRSAKey = async (pem: string): Promise<CryptoKey> => crypto.subtle.importKey(
	'spki',
	await str2ab(window.atob(pem.substring('-----BEGIN PUBLIC KEY-----'.length, pem.length - '-----END PUBLIC KEY-----'.length - 1))),
	{
		name: 'RSA-OAEP',
		hash: 'SHA-256',
	},
	true,
	['encrypt'],
);

/**
 * User connection to the server
 * @type {Peer}
 * @readonly
 */
const peer: Peer = new Peer();

peer.on('connection', (dataConnection: DataConnection): void => {
	dataConnection.on('data', async (data: string): Promise<void> => {
		console.log(`RECEIVED: ${data}`);
		const messageData: MessageData = JSON.parse(data);
		let el: HTMLSpanElement | null = document.getElementById(messageData.from) as HTMLSpanElement | null;
		if (!el)
			el = await createChat(messageData.from, false);
		const paragraph: HTMLParagraphElement = document.createElement('p');
		switch (messageData.event) {
			case MessageDataEvent.RSAKeyShare:
				aesKeys[messageData.from] = [crypto.getRandomValues(new Uint8Array(16)), await window.crypto.subtle.generateKey(
					{
						name: 'AES-CBC',
						length: 256,
					},
					true,
					['encrypt', 'decrypt'],
				)];
				send(messageData.from, {
					from: peer.id,
					body: JSON.stringify([
						Array.from(aesKeys[messageData.from][0]),
						Array.from(new Uint8Array(await crypto.subtle.encrypt(
							{ name: 'RSA-OAEP' },
							await importRSAKey(messageData.body),
							await crypto.subtle.exportKey('raw', aesKeys[messageData.from][1]),
						))),
					]),
					time: '',
					id: '',
					event: MessageDataEvent.AESKeyShare,
				});
				break;
			case MessageDataEvent.AESKeyShare:
				const parsed: Array<any> = JSON.parse(messageData.body);
				aesKeys[messageData.from] = [new Uint8Array(parsed[0]), await crypto.subtle.importKey(
					'raw',
					await crypto.subtle.decrypt(
						{ name: 'RSA-OAEP' },
						(await keyPair).privateKey,
						new Uint8Array(parsed[1]),
					),
					'AES-CBC',
					true,
					['encrypt', 'decrypt'],
				)];
				break;
			case MessageDataEvent.Typing:
				paragraph.innerHTML = 'Typing...';
				paragraph.className = 'typing';
				if (el.lastChild && (el.lastChild as Element).className === 'typing')
					return;
				paragraph.id = messageData.id;
				el.insertAdjacentElement('beforeend', paragraph);
				break;
			case MessageDataEvent.StopTyping:
				if (el.lastChild && (el.lastChild as Element).className === 'typing')
					el.removeChild(el.lastChild);
				break;
			case MessageDataEvent.Delivered:
				let i: number;
				for (i = el.children.length - 1; i >= 0; i--)
					if (el.children[i].id === messageData.id && !el.children[i].innerHTML.endsWith(' <small><small><small><i>✓</i></small></small></small>'))
						break;
				el.children[i].innerHTML += ' <small><small><small><i>✓</i></small></small></small>';
				break;
			case MessageDataEvent.Edit:
				(document.getElementById(messageData.id) as HTMLSpanElement).innerHTML = `${
					new TextDecoder().decode(await crypto.subtle.decrypt(
						{ name: 'AES-CBC', iv: aesKeys[messageData.from][0] },
						aesKeys[messageData.from][1],
						new Uint8Array(JSON.parse(messageData.body)),
					))
				} <small><small><small><i>${messageData.time}</i></small></small></small>`;
				if (el.lastChild && (el.lastChild as Element).className === 'typing')
					el.removeChild(el.lastChild);
				send(messageData.from, {
					from: peer.id,
					body: '',
					time: '',
					id: messageData.id,
					event: MessageDataEvent.Delivered,
				});
				break;
			default:
				paragraph.innerHTML = `${
					new TextDecoder().decode(await crypto.subtle.decrypt(
						{ name: 'AES-CBC', iv: aesKeys[messageData.from][0] },
						aesKeys[messageData.from][1],
						new Uint8Array(JSON.parse(messageData.body)),
					))
				} <small><small><small><i>${messageData.time}</i></small></small></small>`;
				paragraph.className = 'received';
				if (el.lastChild && (el.lastChild as Element).className === 'typing')
					el.removeChild(el.lastChild);
				send(messageData.from, {
					from: peer.id,
					body: '',
					time: '',
					id: messageData.id,
					event: MessageDataEvent.Delivered,
				});
				paragraph.id = messageData.id;
				el.insertAdjacentElement('beforeend', paragraph);
				break;
		}
	});
});

/**
 * Creates a new conversation with the provded `string` ID of a client.
 * @param {string} to - The recipient ID to start a conversation with.
 * @param {boolean} [establishKey = true] - Whether or not to establish a new AES key.
 * @returns {Promise<HTMLSpanElement>} a `Promise<HTMLSpanElement>` that resolves to the newly created `HTMLSpanElement` for the conversation.
 */
const createChat = async (to: string, establishKey: boolean = true): Promise<HTMLSpanElement> => {
	const collapsible = document.createElement('details');
    document.body.insertAdjacentElement('beforeend', collapsible);
	const summary = document.createElement('summary');
	summary.innerHTML = peer.id;
	collapsible.insertAdjacentElement('afterbegin', summary);
	const el = document.createElement('span');
	el.className = 'message';
	el.id = to;
	el.innerHTML = `<u>${to}</u>`;
	collapsible.insertAdjacentElement('beforeend', el);

	if (establishKey)
		send(to, {
			from: peer.id,
			body: await exportRSAKey((await keyPair).publicKey),
			time: '',
			id: '',
			event: MessageDataEvent.RSAKeyShare,
		});

	const sendBar: HTMLInputElement = document.createElement('input');
	sendBar.type = 'text';
	sendBar.className = 'sendBar';
	sendBar.onkeydown = async (event: KeyboardEvent): Promise<void> => {
		if (event.key === 'Enter') {
			sendBar.value = JSON.stringify(Array.from(new Uint8Array(await crypto.subtle.encrypt(
				{ name: 'AES-CBC', iv: aesKeys[to][0] },
				aesKeys[to][1],
				new Uint8Array(new TextEncoder().encode(sendBar.value)),
			))));
			if (editing)
				send(to, {
					from: peer.id,
					body: sendBar.value,
					time: 'edited at ' + new Date().toLocaleTimeString(),
					id: editing,
					event: MessageDataEvent.Edit,
					prev: replying,
				});
			else
				send(to, {
					from: peer.id,
					body: sendBar.value,
					time: new Date().toLocaleTimeString(),
					id: crypto.randomUUID(),
					prev: replying,
				});
			sendBar.value = '';
			replying = undefined;
		} else if (sendBar.value.length === 0 && event.key != 'Backspace')
			send(to, {
				from: peer.id,
				body: '',
				time: '',
				id: '',
				event: MessageDataEvent.Typing,
			});
		else if (sendBar.value.length === 1 && event.key === 'Backspace')
			send(to, {
				from: peer.id,
				body: '',
				time: '',
				id: '',
				event: MessageDataEvent.StopTyping,
			});
	};
	collapsible.insertAdjacentElement('beforeend', sendBar);
	sendBar.focus();
	return el;
}

/**
 * Send a new message to the provided `string` ID of a client.
 * @param {string} to - The recipient ID to send the message to.
 * @param {MessageData} messageData - {@link MessageData} object to send to the recipient.
 */
const send = (to: string, messageData: MessageData): void => {
	const conn: DataConnection = peer.connect(to);
	conn.on('open', async (): Promise<void> => {
		const data: string = JSON.stringify(messageData);
		conn.send(data);
		console.log(`SENT: ${data}`);
		switch (messageData.event) {
			case MessageDataEvent.RSAKeyShare:
			case MessageDataEvent.AESKeyShare:
			case MessageDataEvent.Typing:
			case MessageDataEvent.StopTyping:
				break;
			case MessageDataEvent.Edit:
				(document.getElementById(editing as string) as HTMLSpanElement).innerHTML = `${
					new TextDecoder().decode(await crypto.subtle.decrypt(
						{ name: 'AES-CBC', iv: aesKeys[to][0] },
						aesKeys[to][1],
						new Uint8Array(JSON.parse(messageData.body)),
					))
				} <small><small><small><i>${messageData.time}</i></small></small></small>`;
				break;
			default:
				const paragraph: HTMLParagraphElement = document.createElement('p');
				paragraph.innerHTML = `${
					
				messageData.event !== MessageDataEvent.Delivered ? new TextDecoder().decode(await crypto.subtle.decrypt(
						{ name: 'AES-CBC', iv: aesKeys[to][0] },
						aesKeys[to][1],
						new Uint8Array(JSON.parse(messageData.body)),
					)) : messageData.body
				} <small><small><small><i>${messageData.time}</i></small></small></small>`;
				paragraph.className = 'sent';
				paragraph.id = messageData.id;
				paragraph.onclick = (ev: MouseEvent): void => {
					ev.preventDefault();
					console.log(`REPLYING: ${paragraph.id}`);
					replying = paragraph.id;
					console.log(paragraph);
					((paragraph.parentNode as HTMLSpanElement).nextSibling as HTMLInputElement).focus();
				}
				paragraph.ondblclick = (ev: MouseEvent): void => {
					ev.preventDefault();
					console.log(`EDITING: ${paragraph.id}`);
					replying = undefined;
					if (editing) {
						const prev: HTMLSpanElement = document.getElementById(editing) as HTMLSpanElement;
						prev.innerHTML = prev.innerHTML.replace(/ (<small>){3}<i>✎<\/i>(<\/small>){3}$/g, ' <small><small><small><i>✓</i></small></small></small>');
					}
					editing = paragraph.id;
					if (paragraph.innerHTML.endsWith(' <small><small><small><i>✓</i></small></small></small>')) {
						paragraph.innerHTML = paragraph.innerHTML.replace(/ (<small>){3}<i>✓<\/i>(<\/small>){3}$/g, ' <small><small><small><i>✎</i></small></small></small>');
						((paragraph.parentNode as HTMLSpanElement).nextSibling as HTMLInputElement).value = paragraph.innerHTML.replace(/( (<small>){3}<i>.*<\/i>(<\/small>){3})+$/g, '');
					} else
						throw new Error('Cannot Edit Non-Delivered Message.');
					((paragraph.parentNode as HTMLSpanElement).nextSibling as HTMLInputElement).focus();
				}
				const el: HTMLSpanElement = document.getElementById(to) as HTMLSpanElement;
				if (el.lastChild && (el.lastChild as Element).className === 'typing')
					el.insertBefore(paragraph, el.lastChild);
				else
					el.insertAdjacentElement('beforeend', paragraph);
				break;
		}
		replying = undefined;
		editing = undefined;
	});
}

/**
 * Waits for the client to connect to the server and refreshes the client id.
 */
const check = (): void => {
	if (peer.id) {
		(document.getElementById('id') as HTMLSpanElement).innerHTML += `User ID: ${peer.id}`;
		return;
	}
	setTimeout(check, 50);
}
check();
