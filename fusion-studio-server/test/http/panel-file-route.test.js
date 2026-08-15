const { __test__ } = require('../../lib/http/panel-file-route');

function mockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    sendFile: jest.fn().mockReturnValue('sent'),
  };
}

describe('panel file route hidden path handling', () => {
  test('allows Office thumbnail cache paths through .thumbnails', () => {
    const res = mockResponse();

    const result = __test__.sendPanelFile(
      res,
      '/workspace/ai/Test-Machine/Office/assets/.thumbnails/README.md.png',
      'assets/.thumbnails/README.md.png'
    );

    expect(result).toBe('sent');
    expect(res.sendFile).toHaveBeenCalledWith(
      '/workspace/ai/Test-Machine/Office/assets/.thumbnails/README.md.png',
      { dotfiles: 'allow' }
    );
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-cache');
    expect(res.status).not.toHaveBeenCalled();
  });

  test('keeps non-thumbnail hidden paths unavailable', () => {
    const res = mockResponse();

    __test__.sendPanelFile(
      res,
      '/workspace/ai/Test-Machine/Office/assets/.private/README.md.png',
      'assets/.private/README.md.png'
    );

    expect(res.sendFile).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Not found');
  });

  test('serves normal panel paths without dotfile override', () => {
    const res = mockResponse();

    __test__.sendPanelFile(
      res,
      '/workspace/ai/Test-Machine/Office/assets/README.md',
      'assets/README.md'
    );

    expect(res.sendFile).toHaveBeenCalledWith(
      '/workspace/ai/Test-Machine/Office/assets/README.md',
      undefined
    );
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-cache');
  });
});
